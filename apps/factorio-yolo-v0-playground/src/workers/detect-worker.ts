import type { Detection } from '~/types'

import * as ort from 'onnxruntime-web'
import model from '../../../../models/factorio-yolo-v0/results/weights/best.onnx'

const numClasses = 6
const confidenceThreshold = 0.6
const modelSize = 640
let session: ort.InferenceSession | null = null

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

function generateInv255Lut() {
  // Pre-calculate the inverse to avoid repeated division
  const inv255 = 1 / 255

  const lookupTable = new Float32Array(256)
  for (let i = 0; i < 256; ++i) {
    lookupTable[i] = i * inv255
  }

  return lookupTable
}

const INV255_LUT = generateInv255Lut()

async function detectImageData(imageData: Uint8ClampedArray<ArrayBufferLike>) {
  // #region thanks to cursor!
  const totalPixels = modelSize * modelSize
  const imageDataNormalized = new Float32Array(totalPixels * 3)
  // Pre-calculate offset pointer addresses
  const gChannel = imageDataNormalized.subarray(totalPixels)
  const bChannel = gChannel.subarray(totalPixels)

  // Single pass with direct indexing - much faster than push operations
  for (let i = 0, pixelIndex = 0; pixelIndex < totalPixels; i += 4, ++pixelIndex) {
    imageDataNormalized[pixelIndex] = INV255_LUT[imageData[i]] // R channel
    // Actually we can use bitwise OR instead of addition here as `i` will always be
    // multiple of 4, i.e. xxxxx00b. So `i + 1` will be xxxxx01b, which is the same as `i | 1`
    gChannel[pixelIndex] = INV255_LUT[imageData[i | 1]]
    bChannel[pixelIndex] = INV255_LUT[imageData[i | 2]]
  }
  // #endregion

  if (!session) {
    session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu', 'wasm'] })
  }

  const imageTensor = new ort.Tensor('float32', imageDataNormalized, [1, 3, modelSize, modelSize])

  const { output0 } = await session.run({ images: imageTensor })

  const outputData = output0.data as Float32Array

  const detections = processOutput(outputData, output0.dims[2])

  return detections
}

onmessage = async (event) => {
  const { imageData } = event.data as { imageData: ImageData }
  const detections = await detectImageData(imageData.data)
  postMessage({ detections, imageData })
}
