import { defineEventa, defineInvokeEventa } from '@unbird/eventa'

export const vlmLoadModelInvoke = defineInvokeEventa('vlm-player:eventa:invoke:load-model')
export const vlmGenerateInvoke = defineInvokeEventa<Promise<string>, Blob>('vlm-player:eventa:invoke:generate')

export const vlmModelLoadingProgressEvent = defineEventa<number>('vlm-player:eventa:event:model-load-progress')
