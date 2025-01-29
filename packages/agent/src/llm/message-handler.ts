import { createLogg } from '@guiiai/logg'

import { v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'
import { composeAgent, defineToolFunction, type Message, toolFunction } from 'neuri/openai'
import { z } from 'zod'
import { openaiConfig } from '../config'
import { parseLLMMessage } from '../parser'
import { prompt } from './prompt'

const logger = createLogg('agent').useGlobalConfig()

let agent: ReturnType<typeof composeAgent>['call'] | null = null

async function initAgent() {
  logger.debug('Initializing neuri agent')

  const { call: callAgent } = composeAgent({
    provider: {
      model: 'gpt-4o',
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
    tools: [
      defineToolFunction(
        await toolFunction('getInventoryItems', 'Get the items in the player\'s inventory', z.object({})),
        async () => {
          const response = await v2FactorioConsoleCommandRawPost({ body: { input: '/c remote.call("autorio_tools", "get_inventory_items", 1)' } })
          logger.withFields({ response }).debug('Inventory items')
          return response.data.output
        },
      ),
    ],
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

  const messageFromLLM = response.choices[0].message.content

  logger.withFields({ messageFromLLM }).debug('Message response from LLM')

  if (!messageFromLLM) {
    return null
  }

  return parseLLMMessage(messageFromLLM) // TODO: handle error and retry
}
