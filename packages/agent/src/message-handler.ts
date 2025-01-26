import { createLogg } from '@guiiai/logg'
import { generateText } from '@xsai/generate-text'

import { openaiConfig } from './config'
import { parseLLMMessage } from './parser'
import { prompt } from './prompt'

const logger = createLogg('agent').useGlobalConfig()

export async function handleMessage(message: string) {
  logger.withFields({ message }).debug('Handling message')

  const response = await generateText({
    baseURL: openaiConfig.baseUrl,
    model: 'gpt-4o',
    apiKey: openaiConfig.apiKey,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: message,
      },
    ],
  })

  logger.withFields(response).debug('Message response from AI')

  if (!response.text) {
    return null
  }

  return parseLLMMessage(response.text) // TODO: handle error and retry
}
