import { createLogg } from '@guiiai/logg'

import { composeAgent, type DefinedTool, defineToolFunction, type Message, toolFunction } from 'neuri/openai'
import { openaiConfig } from '../config'
import { parseLLMMessage } from '../parser'
import { prompt } from './prompt'
import { tools } from './tools'

const logger = createLogg('agent').useGlobalConfig()

let agent: ReturnType<typeof composeAgent>['call'] | null = null

async function initAgent() {
  logger.debug('Initializing neuri agent')

  const toolFunctions: DefinedTool<any, any>[] = []

  for (const tool of tools) {
    toolFunctions.push(defineToolFunction(await toolFunction(tool.name, tool.description, tool.schema), tool.fn))
  }

  const { call: callAgent } = composeAgent({
    provider: {
      model: 'gpt-4o',
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
    tools: toolFunctions,
  })

  return callAgent
}

export async function handleMessage(message: string) {
  if (!agent) {
    agent = await initAgent()
  }

  logger.withFields({ message }).debug('Handling message')

  const messages: Message[] = [
    {
      role: 'system',
      content: prompt,
    },
    {
      role: 'user',
      content: message,
    },
  ]

  const response = await agent(messages, {
    model: 'gpt-4o',
    maxRoundTrip: 10,
  })

  if (!response) {
    return null
  }

  if (!response.choices || !response.choices.length) {
    logger.error('LLM responded with no choices')

    return null
  }

  const messageFromLLM = response.choices[0].message.content

  logger.withFields({ messageFromLLM }).debug('Message response from LLM')

  if (!messageFromLLM) {
    return null
  }

  return parseLLMMessage(messageFromLLM) // TODO: handle error and retry
}
