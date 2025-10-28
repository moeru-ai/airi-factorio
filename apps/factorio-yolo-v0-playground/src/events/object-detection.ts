import type { Detection } from '~/types'
import { defineInvokeEventa } from '@unbird/eventa'

export const objectDetectionInvoke = defineInvokeEventa<Promise<{ detections: Detection[], _transfer: ArrayBuffer[] }>, ArrayBuffer>('object-detection:eventa:invoke:detect')
