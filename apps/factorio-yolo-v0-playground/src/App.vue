<script setup lang="ts">
import type { Detection } from './types'
import NoVncClient from '@novnc/novnc/lib/rfb'
import { defineInvoke } from '@unbird/eventa'
import { createContext } from '@unbird/eventa/adapters/webworkers'

import { useFileDialog, useLocalStorage } from '@vueuse/core'
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'
import { Button as TheButton } from '~/components/ui/button'
import { Input as TheInput } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { isDark, toggleDark } from '~/composables/dark'
import DetectWorker from '~/workers/detect-worker?worker'
import VlmPlayWorker from '~/workers/vlm-play-worker?worker'
import { objectDetectionInvoke } from './events/object-detection'
import { vlmGenerateInvoke, vlmLoadModelInvoke, vlmModelLoadingProgressEvent } from './events/vlm-play-worker'

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

const objectDetectionContext = createContext(new DetectWorker()).context
const detectObject = defineInvoke(objectDetectionContext, objectDetectionInvoke)

const loadingVlmModel = ref(false)
const vlmModelLoaded = ref(false)
const vlmModelLoadingProgress = ref(0)
const detectWorkerInstance = new DetectWorker()
const vlmPlayWorkerContext = createContext(new VlmPlayWorker()).context
vlmPlayWorkerContext.on(vlmModelLoadingProgressEvent, (progress) => {
  vlmModelLoadingProgress.value = progress.body ?? 0
})
const vlmLoadModel = defineInvoke(vlmPlayWorkerContext, vlmLoadModelInvoke)
const vlmGenerate = defineInvoke(vlmPlayWorkerContext, vlmGenerateInvoke)
const vlmOutput = ref('')

function useFps() {
  let frameCount = 0
  let lastTime = 0
  const fps = ref(0)

  function updateFps() {
    frameCount++
    const currentTime = performance.now()
    const elapsed = (currentTime - lastTime) * 0.001
    if (elapsed >= 1) {
      fps.value = Math.round(frameCount / elapsed)
      frameCount = 0
      lastTime = currentTime
    }
  }

  updateFps()

  return {
    fps,
    updateFps,
  }
}

const { fps, updateFps } = useFps()

const tab = useLocalStorage('factorio-yolo-v0-playground/current-tab', 'image')
const vncAddress = useLocalStorage('factorio-yolo-v0-playground/vnc-address', 'ws://localhost:5901/websockify')
const vncView = useTemplateRef<HTMLDivElement>('vncView')
const vncClient = ref<NoVncClient | null>(null)
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
    ctx.fillText(`${names.value[detection.classId]}: ${detection.confidence.toFixed(2)}`, detection.topLeftX, detection.topLeftY)
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

function invokeWithAnimationFrame(fn: () => Promise<void>) {
  const animationFrameId = ref<number | null>(null)
  let requestToStop = false

  function pause() {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }

    requestToStop = true
  }

  function resume() {
    fn().then(() => {
      if (requestToStop) {
        return
      }

      animationFrameId.value = requestAnimationFrame(resume)
    }).catch((error) => {
      console.error(error)
    })
  }

  const isRunning = computed(() => animationFrameId.value !== null)

  return {
    pause,
    resume,
    isRunning,
  }
}

const getVncFrameAndDetect = invokeWithAnimationFrame(
  async () => {
    if (!vncClient.value) {
      return
    }

    if (!vncCanvas.value) {
      return
    }

    if (!vncCanvas.value.width || !vncCanvas.value.height) {
      return
    }

    const ctx = vncCanvas.value.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return
    }

    if (!canvasRef.value) {
      console.error('Failed to get canvas element')
      return
    }

    const canvasCtx = canvasRef.value.getContext('2d')
    if (!canvasCtx) {
      console.error('Failed to get canvas context')
      return
    }

    const imageData = ctx.getImageData(0, 0, vncCanvas.value.width, vncCanvas.value.height)
    const { detections, _transfer } = await detectObject(imageData.data.buffer, { transfer: [imageData.data.buffer] })

    canvasCtx.clearRect(0, 0, modelSize.value, modelSize.value)
    canvasCtx.putImageData(new ImageData(new Uint8ClampedArray(_transfer[0]), vncCanvas.value.width, vncCanvas.value.height), 0, 0)
    drawDetections(detections)

    updateFps()
    canvasCtx.fillStyle = 'rgb(0, 255, 0)'
    canvasCtx.font = '20px Arial'
    canvasCtx.fillText(`FPS: ${fps.value}`, 0, 20)
  },
)

const getVncFrameAndGenerate = invokeWithAnimationFrame(
  async () => {
    if (!vncClient.value) {
      return
    }

    if (!vncCanvas.value) {
      return
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      if (!vncCanvas.value) {
        reject(new Error('Failed to get VNC canvas element'))
        return
      }

      const waitForCanvasPrepared = () => {
        if (!vncCanvas.value) {
          requestAnimationFrame(waitForCanvasPrepared)
          return
        }

        vncCanvas.value.toBlob((blob) => {
          if (!blob) {
            requestAnimationFrame(waitForCanvasPrepared)
            return
          }

          resolve(blob)
        })
      }

      waitForCanvasPrepared()
    })

    const result = await vlmGenerate(blob)
    vlmOutput.value = result
  },
)

async function onLoadVlmModelBtnClick() {
  if (vlmModelLoaded.value) {
    return
  }

  loadingVlmModel.value = true
  vlmModelLoadingProgress.value = 0
  await vlmLoadModel(undefined)
  loadingVlmModel.value = false
  vlmModelLoaded.value = true
}

function onConnectVncBtnClick() {
  if (!vncView.value) {
    toast.error('Failed to get VNC view element')
    return
  }

  vncClient.value = new NoVncClient(vncView.value, vncAddress.value)
  vncClient.value.scaleViewport = true
  vncCanvas.value = vncView.value.querySelector('canvas')

  if (tab.value === 'vnc') {
    getVncFrameAndDetect.resume()
  }
  else if (tab.value === 'vlm') {
    getVncFrameAndGenerate.resume()
  }
}

function onTabChange(value: string | number) {
  if (value !== 'vnc' && value !== 'vlm' && vncClient.value) {
    vncClient.value.disconnect()
    vncClient.value = null

    getVncFrameAndDetect.pause()
    getVncFrameAndGenerate.pause()
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
    getVncFrameAndDetect.pause()
    getVncFrameAndGenerate.pause()
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

    <Tabs v-model="tab" :disabled="loadingVlmModel" default-value="image" @update:model-value="onTabChange">
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
          <TabsTrigger value="vlm">
            VLM
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
          <TheButton variant="outline" as="a" size="icon" px-2 href="https://github.com/moeru-ai/airi-factorio/tree/main/apps/factorio-yolo-v0-playground/README.md" target="_blank">
            <span i-solar-question-circle-bold text-xl />
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
      <TabsContent value="vlm">
        <div class="lg:hidden mb-2 text-sm text-gray-500 text-center">
          Please use larger screen to get better experience.
        </div>
        <div flex gap-2 mb-2>
          <TheInput v-model="vncAddress" />
          <TheButton v-if="!vlmModelLoaded" :disabled="loadingVlmModel" variant="outline" @click="onLoadVlmModelBtnClick">
            {{ vlmModelLoadingProgress !== 0 ? `Loading... ${vlmModelLoadingProgress}%` : 'Load Model' }}
          </TheButton>
          <TheButton v-else-if="getVncFrameAndGenerate.isRunning.value" variant="outline" @click="() => getVncFrameAndGenerate.pause()">
            Stop
          </TheButton>
          <TheButton v-else variant="outline" @click="onConnectVncBtnClick">
            Connect
          </TheButton>
          <TheButton variant="outline" as="a" size="icon" px-2 href="https://github.com/moeru-ai/airi-factorio/tree/main/apps/factorio-yolo-v0-playground/README.md" target="_blank">
            <span i-solar-question-circle-bold text-xl />
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
          <div w="60 md:90 lg:120" h="60 md:90 lg:120" rounded-lg border="1 gray-200 dark:gray-700" overflow-y-scroll>
            <div
              v-if="!vlmOutput" w-full h-full flex
              justify-center items-center text-gray-500 text-sm
            >
              Waiting for output...
            </div>
            <div v-else w="full h-full" p="4" text="sm">
              {{ vlmOutput }}
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
