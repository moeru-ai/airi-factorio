import type { LlavaProcessor, PreTrainedModel, PreTrainedTokenizer } from '@huggingface/transformers'
import { AutoModelForImageTextToText, AutoProcessor, RawImage } from '@huggingface/transformers'
import { defineInvokeHandler } from '@unbird/eventa'
import { createContext } from '@unbird/eventa/adapters/webworkers/worker'
import { vlmGenerateInvoke, vlmLoadModelInvoke, vlmModelLoadingProgressEvent } from '~/events/vlm-play-worker'

// Load processor and model
const model_id = 'onnx-community/FastVLM-0.5B-ONNX'
let model: PreTrainedModel | null = null
let processor: LlavaProcessor | null = null

const { context } = createContext()

async function loadModel() {
  const file_progress: Record<string, number> = {}
  let total_progress = 0

  model = await AutoModelForImageTextToText.from_pretrained(model_id, {
    dtype: {
      embed_tokens: 'fp16',
      vision_encocder: 'q4',
      decoder_model_merged: 'q4',
    },

    progress_callback: (p) => {
      if (p.status !== 'progress') {
        return
      }
      file_progress[p.name] = p.progress
      const progress = Object.values(file_progress).reduce((acc, curr) => acc + curr, 0) / Object.values(file_progress).length
      if (progress > total_progress) {
        total_progress = progress
        context.emit(vlmModelLoadingProgressEvent, total_progress)
      }
    },
    device: 'webgpu',
  })

  processor = await AutoProcessor.from_pretrained(model_id)
}

async function generate(image_in: Blob) {
  if (!processor || !model) {
    throw new Error('Model or processor not loaded')
  }

  const image = await RawImage.fromBlob(image_in)

  const conversation: Parameters<PreTrainedTokenizer['apply_chat_template']>[0] = [
    {
      role: 'rule',
      content: `<image>You are playing the game Factorio, you will move the character based on the image. You MUST only use one of the keycodes W(up), A(left), S(down), or D(right) in the output.`,
    },
  ]

  const prompt = processor.apply_chat_template(conversation, {

    add_generation_prompt: true,
  })

  const inputs = await processor(image, prompt, { add_special_tokens: false })

  // Perform inference
  const outputs = await model.generate({
    ...inputs,

    max_new_tokens: 256,
    do_sample: false,
  })

  // Decode output
  const decoded = processor.batch_decode(
    outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),

    { skip_special_tokens: true },
  )

  return decoded[0]
}

function withErrorCatch<T extends unknown[], R>(fn: (...args: T) => Promise<R | null>) {
  return async (...args: T) => {
    try {
      return await fn(...args)
    }
    catch (e) {
      console.error(e)
      throw e
    }
  }
}

defineInvokeHandler(context, vlmLoadModelInvoke, withErrorCatch(loadModel))
defineInvokeHandler(context, vlmGenerateInvoke, withErrorCatch(generate))
