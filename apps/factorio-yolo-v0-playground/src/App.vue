<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'

import * as ort from 'onnxruntime-web'

import { onUnmounted, ref, useTemplateRef } from 'vue'

import { toast } from 'vue-sonner'

import model from '../../../models/factorio-yolo-v0/results/weights/best.onnx'

import { isDark, toggleDark } from './composables/dark'

interface Detection {
  topLeftX: number
  topLeftY: number
  bottomRightX: number
  bottomRightY: number
  classId: number
  confidence: number
}

const session = ref<ort.InferenceSession | null>(null)
const objectUrls = ref<string[]>([])
const modelSize = ref(640)
const numClasses = 6
const confidenceThreshold = 0.6
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
const names = ref([
  'assembling-machine-1',
  'assembling-machine-2',
  'assembling-machine-3',
  'transport-belt',
  'fast-transport-belt',
  'express-transport-belt',
])

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

function iou(box1: Detection, box2: Detection): number {
  const x1 = Math.max(box1.topLeftX, box2.topLeftX)
  const y1 = Math.max(box1.topLeftY, box2.topLeftY)
  const x2 = Math.min(box1.bottomRightX, box2.bottomRightX)
  const y2 = Math.min(box1.bottomRightY, box2.bottomRightY)

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const box1Area = (box1.bottomRightX - box1.topLeftX) * (box1.bottomRightY - box1.topLeftY)
  const box2Area = (box2.bottomRightX - box2.topLeftX) * (box2.bottomRightY - box2.topLeftY)
  const unionArea = box1Area + box2Area - intersectionArea
  return intersectionArea / unionArea
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

function processOutput(outputData: Float32Array, numCandidates: number) {
  const detections: Detection[] = []

  for (let i = 0; i < numCandidates; i++) {
    const centerX = outputData[i]
    const centerY = outputData[numCandidates + i]
    const width = outputData[2 * numCandidates + i]
    const height = outputData[3 * numCandidates + i]
    let best = -Infinity
    let classId = -1

    // get the class with the highest confidence
    for (let c = 0; c < numClasses; c++) {
      const confidence = outputData[(4 + c) * numCandidates + i]
      if (confidence > best) {
        best = confidence
        classId = c
      }
    }

    const topLeftX = centerX - width / 2
    const topLeftY = centerY - height / 2
    const bottomRightX = centerX + width / 2
    const bottomRightY = centerY + height / 2

    const detection = {
      topLeftX,
      topLeftY,
      bottomRightX,
      bottomRightY,
      classId,
      confidence: best,
    }

    if (best < confidenceThreshold) {
      continue
    }

    detections.push(detection)
  }

  detections.sort((a, b) => b.confidence - a.confidence)
  const iouThreshold = 0.6
  const finalDetections: Detection[] = []

  while (detections.length > 0) {
    const current = detections.shift()!
    finalDetections.push(current)

    for (let i = detections.length - 1; i >= 0; i--) {
      if (iou(current, detections[i]) >= iouThreshold) {
        detections.splice(i, 1)
      }
    }
  }

  return finalDetections
}

async function onFileChange(file: File) {
  if (!file) {
    toast.error('No file selected')
    return
  }

  if (!canvasRef.value) {
    toast.error('Failed to get canvas element')
    return
  }

  const img = await createImageBitmap(file)
  const imageEl = document.createElement('img')
  imageEl.src = URL.createObjectURL(file)
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

  const pixels = imgCtx.getImageData(dx, dy, modelSize.value, modelSize.value).data

  const r: number[] = []
  const g: number[] = []
  const b: number[] = []
  for (let i = 0; i < modelSize.value * modelSize.value * 4; i += 4) {
    r.push(pixels[i] / 255)
    g.push(pixels[i + 1] / 255)
    b.push(pixels[i + 2] / 255)
  }
  const imageDataNormalized = [...r, ...g, ...b]

  session.value = await ort.InferenceSession.create(model)

  const imageTensor = new ort.Tensor('float32', imageDataNormalized, [1, 3, modelSize.value, modelSize.value])

  const { output0 } = await session.value.run({ images: imageTensor })
  const outputData = output0.data as Float32Array
  const detections = processOutput(outputData, output0.dims[2])

  drawDetections(detections)
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

onUnmounted(() => {
  objectUrls.value.forEach(url => URL.revokeObjectURL(url))
})
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
    <div class="flex gap-4 text-gray-500 text-lg">
      <div v-if="isDark" cursor-pointer i-solar-cloudy-moon-bold-duotone @click="toggleDark()" />
      <div v-else cursor-pointer i-solar-sun-2-bold @click="toggleDark()" />
      <a i-carbon-logo-github href="https://github.com/moeru-ai/airi-factorio/tree/main/models/factorio-yolo-v0" target="_blank" />
      <a i-simple-icons-huggingface href="https://huggingface.co/spaces/proj-airi/factorio-yolo-v0-playground" target="_blank" />
    </div>
  </div>
</template>
