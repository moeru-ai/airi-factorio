import { createLogg } from '@guiiai/logg'
import { generateText } from '@xsai/generate-text'

import { openaiConfig } from './config'

const logger = createLogg('agent').useGlobalConfig()

export async function handleMessage(message: string) {
  logger.withFields({ message }).debug('Handling message')

  const response = await generateText({
    baseURL: openaiConfig.baseUrl,
    model: 'gpt-4o',
    apiKey: openaiConfig.apiKey,
    messages: [
      {
        role: 'user',
        content: message,
      },
    ],
  })

  logger.withFields(response).debug('Message response from AI')

  return response.text
}
