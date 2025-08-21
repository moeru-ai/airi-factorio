import type { App } from 'vue'

export type UserModule = (app: App<Element>) => void

export interface Detection {
  topLeftX: number
  topLeftY: number
  bottomRightX: number
  bottomRightY: number
  classId: number
  confidence: number
}
