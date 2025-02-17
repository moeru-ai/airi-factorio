import type { DefinedTool, Message } from 'neuri/openai'

import type { StdoutMessage } from '../parser'
import { createLogg } from '@guiiai/logg'
import { composeAgent, defineToolFunction, system, toolFunction, user } from 'neuri/openai'
import { openaiConfig } from '../config'
import { parseLLMMessage } from '../parser'
import prompt from './prompt.md?raw'
import { tools } from './tools'

const logger = createLogg('agent').useGlobalConfig()

export async function createMessageHandler() {
  const toolFunctions: DefinedTool<any, any>[] = []

  for (const tool of tools) {
    toolFunctions.push(defineToolFunction(await toolFunction(tool.name, tool.description, tool.schema), tool.fn))
  }

  const agent = composeAgent({
    provider: {
      model: 'gpt-4o',
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
    tools: toolFunctions,
  })

  const messages: Message[] = [system(prompt)]

  async function handleMessage(message: StdoutMessage) {
    logger.withFields({ message }).debug('Handling message')

    if (message.type === 'chat') {
      messages.push(user(`[CHAT] ${message.message}`))
    }
    else if (message.type === 'modError') {
      messages.push(user(`[MOD] Error: ${message.error}`))
    }
    else if (message.type === 'operationsCompleted') {
      messages.push(user(`[MOD] All operations completed`))
    }

    const response = await agent.call(messages, {
      model: 'gpt-4o',
      maxRoundTrip: 10,
    })

    if (!response) {
      logger.withFields({ response }).error('LLM responded with null')
      return null
    }

    if (!response.choices || !response.choices.length) {
      logger.withFields({ response }).error('LLM responded with no choices')
      return null
    }

    const messageFromLLM = response.choices[0].message.content
    logger.withFields({ messageFromLLM }).debug('Message response from LLM')
    if (!messageFromLLM) {
      return null
    }

    return parseLLMMessage(messageFromLLM)
  }

  return {
    handleMessage,
  }
}

export type MessageHandler = Awaited<ReturnType<typeof createMessageHandler>>
