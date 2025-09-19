import type { PreTrainedModel, PreTrainedTokenizer, Processor } from '@huggingface/transformers'
import { AutoProcessor, Qwen2VLForConditionalGeneration, RawImage } from '@huggingface/transformers'
import { defineInvokeHandler } from '@unbird/eventa'
import { createContext } from '@unbird/eventa/adapters/webworkers/worker'
import { vlmGenerateInvoke, vlmLoadModelInvoke, vlmModelLoadingProgressEvent } from '~/events/vlm-play-worker'

// Load processor and model
const modelId = 'onnx-community/Qwen2-VL-2B-Instruct'
let model: PreTrainedModel | null = null
let processor: Processor | null = null

const { context } = createContext()

async function loadModel() {
  const fileProgress: Record<string, number> = {}
  let totalProgress = 0

  model = await Qwen2VLForConditionalGeneration.from_pretrained(modelId, {
    // eslint-disable-next-line ts/naming-convention
    progress_callback: (p) => {
      if (p.status !== 'progress') {
        return
      }
      fileProgress[p.name] = p.progress
      const progress = Object.values(fileProgress).reduce((acc, curr) => acc + curr, 0) / Object.values(fileProgress).length
      if (progress > totalProgress) {
        totalProgress = progress
        context.emit(vlmModelLoadingProgressEvent, totalProgress)
      }
    },
    device: 'webgpu',
  })

  processor = await AutoProcessor.from_pretrained(modelId, { device: 'webgpu' })
}

async function generate(imageIn: Blob) {
  if (!processor || !model) {
    throw new Error('Model or processor not loaded')
  }

  const image = await (await RawImage.fromBlob(imageIn)).resize(448, 448)

  const conversation: Parameters<PreTrainedTokenizer['apply_chat_template']>[0] = [
    {
      role: 'user',
      content: [
        { type: 'image' },
        { type: 'text', text: 'Describe this image.' },
      ],
    },
  ]

  const text = processor.apply_chat_template(conversation, {
    // eslint-disable-next-line ts/naming-convention
    add_generation_prompt: true,
  })

  const inputs = await processor(text, image)

  // Perform inference
  const outputs = await model.generate({
    ...inputs,
    // eslint-disable-next-line ts/naming-convention
    max_new_tokens: 128,
  })

  // Decode output
  const decoded = processor.batch_decode(
    outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
    // eslint-disable-next-line ts/naming-convention
    { skip_special_tokens: true },
  )

  return decoded[0]
}

defineInvokeHandler(context, vlmLoadModelInvoke, loadModel)
defineInvokeHandler(context, vlmGenerateInvoke, async (image: Blob) => {
  try {
    return await generate(image)
  }
  catch (e) {
    console.error(e)
    throw e
  }
})
