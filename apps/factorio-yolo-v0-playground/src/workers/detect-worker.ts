import type { Detection } from '~/types'

import * as ort from 'onnxruntime-web'
import model from '../../../../models/factorio-yolo-v0/results/weights/best.onnx'

const numClasses = 6
const confidenceThreshold = 0.6
const modelSize = 640
let session: ort.InferenceSession | null = null

function iou(box1: Detection, box2: Detection): number {
  // Early exit: check if boxes are completely separate (no overlap)
  if (box1.bottomRightX <= box2.topLeftX || box2.bottomRightX <= box1.topLeftX
    || box1.bottomRightY <= box2.topLeftY || box2.bottomRightY <= box1.topLeftY) {
    return 0
  }

  // Calculate intersection coordinates
  const x1 = Math.max(box1.topLeftX, box2.topLeftX)
  const y1 = Math.max(box1.topLeftY, box2.topLeftY)
  const x2 = Math.min(box1.bottomRightX, box2.bottomRightX)
  const y2 = Math.min(box1.bottomRightY, box2.bottomRightY)

  // Intersection area (no need for Math.max since we checked overlap above)
  const intersectionArea = (x2 - x1) * (y2 - y1)

  // Use pre-computed areas if available, fallback to calculation
  const box1Area = box1.area ?? (box1.bottomRightX - box1.topLeftX) * (box1.bottomRightY - box1.topLeftY)
  const box2Area = box2.area ?? (box2.bottomRightX - box2.topLeftX) * (box2.bottomRightY - box2.topLeftY)

  const unionArea = box1Area + box2Area - intersectionArea

  return intersectionArea / unionArea
}

function processOutput(outputData: Float32Array, numCandidates: number) {
  const detections: Detection[] = []

  // Pre-calculate array offsets to avoid repeated multiplication
  const yOffset = numCandidates
  const wOffset = 2 * numCandidates
  const hOffset = 3 * numCandidates
  const classOffset = 4 * numCandidates

  for (let i = 0; i < numCandidates; i++) {
    // Find max confidence class first (early exit if below threshold)
    let best = -Infinity
    let classId = -1

    for (let c = 0; c < numClasses; c++) {
      const confidence = outputData[classOffset + c * numCandidates + i]
      if (confidence > best) {
        best = confidence
        classId = c
      }
    }

    // Early exit for low confidence - avoid expensive box calculations
    if (best < confidenceThreshold) {
      continue
    }

    // Only calculate box coordinates for high-confidence detections
    const centerX = outputData[i]
    const centerY = outputData[yOffset + i]
    const width = outputData[wOffset + i]
    const height = outputData[hOffset + i]

    // Pre-calculate half dimensions to avoid repeated division
    const halfWidth = width * 0.5
    const halfHeight = height * 0.5

    detections.push({
      topLeftX: centerX - halfWidth,
      topLeftY: centerY - halfHeight,
      bottomRightX: centerX + halfWidth,
      bottomRightY: centerY + halfHeight,
      classId,
      confidence: best,
      area: width * height, // Pre-compute area for faster IoU
    })
  }

  // Sort once by confidence (descending)
  detections.sort((a, b) => b.confidence - a.confidence)

  // Optimized NMS - use index-based approach to avoid array mutations
  const iouThreshold = 0.6
  const keep = Array.from({ length: detections.length }, () => true)

  for (let i = 0; i < detections.length; i++) {
    if (!keep[i])
      continue

    const current = detections[i]

    // Mark overlapping boxes for removal
    for (let j = i + 1; j < detections.length; j++) {
      if (keep[j] && iou(current, detections[j]) >= iouThreshold) {
        keep[j] = false
      }
    }
  }

  // Filter final results in one pass
  const finalDetections: Detection[] = []
  for (let i = 0; i < detections.length; i++) {
    if (keep[i]) {
      finalDetections.push(detections[i])
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
