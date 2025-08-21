<script setup lang="ts">
import type { Detection } from './types'
import NoVncClient from '@novnc/novnc/lib/rfb'
import { useFileDialog, useLocalStorage } from '@vueuse/core'
import { onUnmounted, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'

import { Button as TheButton } from '~/components/ui/button'
import { Input as TheInput } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { isDark, toggleDark } from '~/composables/dark'
import DetectWorker from '~/workers/detect-worker?worker'

const objectUrls = ref<string[]>([])
const modelSize = ref(640)
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
const names = ref([
  'assembling-machine-1',
  'assembling-machine-2',
  'assembling-machine-3',
  'transport-belt',
  'fast-transport-belt',
  'express-transport-belt',
])
const detectWorkerInstance = new DetectWorker()

const tab = useLocalStorage('factorio-yolo-v0-playground/current-tab', 'image')
const vncAddress = useLocalStorage('factorio-yolo-v0-playground/vnc-address', 'ws://localhost:5901/websockify')
const vncView = useTemplateRef<HTMLDivElement>('vncView')
const vncClient = ref<NoVncClient | null>(null)
const vncAnimationFrameId = ref<number | null>(null)
const vncCanvas = ref<HTMLCanvasElement | null>(null)

function processSize(width: number, height: number, maxSize: number): [number, number] {
  if (width > height) {
    return [maxSize, Math.round(maxSize * height / width)]
  }
  return [Math.round(maxSize * width / height), maxSize]
}

async function waitForImageLoad(imageEl: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    imageEl.onload = () => resolve()
  })
}

function drawDetections(detections: Detection[]) {
  if (!canvasRef.value) {
    return
  }

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) {
    return
  }

  ctx.strokeStyle = 'rgb(0, 255, 0)'
  ctx.fillStyle = 'rgb(0, 255, 0)'
  ctx.font = '20px Arial'
  ctx.lineWidth = 2
  for (const detection of detections) {
    ctx.strokeRect(detection.topLeftX, detection.topLeftY, detection.bottomRightX - detection.topLeftX, detection.bottomRightY - detection.topLeftY)
    ctx.fillText(names.value[detection.classId], detection.topLeftX, detection.topLeftY)
  }
}

async function detectBlob(blob: Blob) {
  if (!canvasRef.value) {
    toast.error('Failed to get canvas element')
    return
  }

  const img = await createImageBitmap(blob)
  const imageEl = document.createElement('img')
  imageEl.src = URL.createObjectURL(blob)
  objectUrls.value.push(imageEl.src)
  await waitForImageLoad(imageEl)

  const [newWidth, newHeight] = processSize(img.width, img.height, modelSize.value)
  imageEl.width = newWidth
  imageEl.height = newHeight

  const imgCtx = canvasRef.value.getContext('2d')
  if (!imgCtx) {
    toast.error('Failed to get canvas context')
    return
  }

  imgCtx.clearRect(0, 0, modelSize.value, modelSize.value)
  imgCtx.fillStyle = 'rgb(114, 114, 114)'
  imgCtx.fillRect(0, 0, modelSize.value, modelSize.value)

  // center the image in the canvas
  const dx = (modelSize.value - newWidth) / 2
  const dy = (modelSize.value - newHeight) / 2
  imgCtx.drawImage(imageEl, dx, dy, newWidth, newHeight)

  const imageData = imgCtx.getImageData(dx, dy, modelSize.value, modelSize.value)
  detectWorkerInstance.postMessage({ imageData })
}

async function onFileChange(file: File) {
  if (!file) {
    toast.error('No file selected')
    return
  }

  detectBlob(file)
}

const fileDialog = useFileDialog({
  accept: 'image/*',
  multiple: false,
})

fileDialog.onChange((files) => {
  if (!files) {
    return
  }

  onFileChange(files[0])
})

async function getVncFrameAndDetect() {
  if (!vncClient.value) {
    vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
    return
  }

  if (!vncCanvas.value) {
    vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
    return
  }

  if (!vncCanvas.value.width || !vncCanvas.value.height) {
    vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
    return
  }

  const ctx = vncCanvas.value.getContext('2d')
  if (!ctx) {
    vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
    return
  }

  const imageData = ctx.getImageData(0, 0, vncCanvas.value.width, vncCanvas.value.height)
  detectWorkerInstance.postMessage({ imageData })

  await new Promise<void>((resolve) => {
    detectWorkerInstance.onmessage = (event) => {
      if (!canvasRef.value) {
        return
      }

      const canvasCtx = canvasRef.value.getContext('2d')
      if (!canvasCtx) {
        return
      }

      const { detections, imageData } = event.data

      canvasCtx.clearRect(0, 0, modelSize.value, modelSize.value)
      canvasCtx.putImageData(imageData, 0, 0)
      drawDetections(detections)

      detectWorkerInstance.onmessage = null
      resolve()
    }
  })

  vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
}

function cancelVncDetect() {
  if (vncAnimationFrameId.value) {
    cancelAnimationFrame(vncAnimationFrameId.value)
    vncAnimationFrameId.value = null
  }
}

function onConnectVncBtnClick() {
  if (!vncView.value) {
    toast.error('Failed to get VNC view element')
    return
  }

  vncClient.value = new NoVncClient(vncView.value, vncAddress.value)
  vncClient.value.scaleViewport = true
  vncCanvas.value = vncView.value.querySelector('canvas')
  vncAnimationFrameId.value = requestAnimationFrame(getVncFrameAndDetect)
}

function onTabChange(value: string | number) {
  if (value !== 'vnc' && vncClient.value) {
    vncClient.value.disconnect()
    vncClient.value = null

    cancelVncDetect()
  }
}

onUnmounted(() => {
  objectUrls.value.forEach(url => URL.revokeObjectURL(url))
})

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    vncClient.value?.disconnect()
    vncClient.value = null
    vncCanvas.value = null
    cancelVncDetect()
  })
}
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center items-center">
    <div class="flex flex-col gap-2 mb-8">
      <div class="text-3xl font-bold text-center">
        Factorio YOLO v0
      </div>
      <div class="text-gray-500 text-sm text-center">
        The playground for the Factorio YOLO v0 model.
      </div>
    </div>

    <Tabs v-model="tab" default-value="image" @update:model-value="onTabChange">
      <div w-full flex justify-center>
        <TabsList mx-auto>
          <TabsTrigger value="image">
            Image
          </TabsTrigger>
          <TabsTrigger value="video">
            Video
          </TabsTrigger>
          <TabsTrigger value="vnc">
            VNC
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="image">
        <div
          w="80 md:120 lg:160"
          h="80 md:120 lg:160" overflow-hidden rounded-lg
          relative cursor-pointer
          border="1 gray-200 dark:gray-700"
          transition-all duration-300
          mb-4
          @click="fileDialog.open()"
        >
          <canvas
            ref="canvasRef" :width="modelSize"
            :height="modelSize" class="origin-top-left"
            scale="50 md:75 lg:100"
            transition-all duration-300
          />
          <div
            v-if="!objectUrls.length"
            absolute top-0 left-0 w-full h-full flex
            justify-center items-center text-gray-500 text-sm
          >
            Click to select a image <br> (Square image required)
          </div>
        </div>
      </TabsContent>
      <TabsContent value="video">
        TODO
      </TabsContent>
      <TabsContent value="vnc">
        <div class="lg:hidden mb-2 text-sm text-gray-500 text-center">
          Please use larger screen to get better experience.
        </div>
        <div flex gap-2 mb-2>
          <TheInput v-model="vncAddress" />
          <TheButton variant="outline" @click="onConnectVncBtnClick">
            Connect
          </TheButton>
        </div>
        <div class="flex gap-2">
          <div
            w="60 md:90 lg:120"
            h="60 md:90 lg:120" overflow-hidden rounded-lg
            relative
            border="1 gray-200 dark:gray-700"
            transition-all duration-300
            mb-4
          >
            <div ref="vncView" w-full h-full class="vnc-container" />
            <div
              v-if="!vncClient"
              absolute top-0 left-0 w-full h-full flex
              justify-center items-center text-gray-500 text-sm
            >
              VNC view
            </div>
          </div>
          <div
            w="60 md:90 lg:120"
            h="60 md:90 lg:120" overflow-hidden rounded-lg
            relative
            border="1 gray-200 dark:gray-700"
            transition-all duration-300
            mb-4
          >
            <div scale-75 origin-top-left>
              <canvas
                ref="canvasRef" :width="modelSize"
                :height="modelSize" class="origin-top-left"
                scale="50 md:75 lg:100"
                transition-all duration-300
              />
            </div>
            <div
              v-if="!vncCanvas"
              absolute top-0 left-0 w-full h-full flex
              justify-center items-center text-gray-500 text-sm
            >
              Detection result
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <div class="flex gap-4 text-gray-500 text-lg">
      <div v-if="isDark" cursor-pointer i-solar-cloudy-moon-bold-duotone @click="toggleDark()" />
      <div v-else cursor-pointer i-solar-sun-2-bold @click="toggleDark()" />
      <a i-carbon-logo-github href="https://github.com/moeru-ai/airi-factorio/tree/main/models/factorio-yolo-v0" target="_blank" />
      <a i-simple-icons-huggingface href="https://huggingface.co/spaces/proj-airi/factorio-yolo-v0-playground" target="_blank" />
    </div>
  </div>
</template>
