import type { MessageHandler } from './llm/message-handler'
import type { StdoutMessage } from './parser'
import { Buffer } from 'node:buffer'
import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { client, v2FactorioConsoleCommandMessagePost, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'
import { connect } from 'it-ws'
import { initEnv, rconClientConfig, wsClientConfig } from './config'
import { createMessageHandler } from './llm/message-handler'

import { parseChatMessage, parseModErrorMessage, parseTaskCompletedMessage } from './parser'

setGlobalFormat(Format.Pretty)
const logger = useLogg('main').useGlobalConfig()

async function executeCommandFromAgent<T extends StdoutMessage>(message: T, messageHandler: MessageHandler) {
  const llmResponse = await messageHandler.handleMessage(message)
  if (!llmResponse) {
    logger.error('Failed to handle message')
    return
  }

  await v2FactorioConsoleCommandMessagePost({
    body: {
      message: llmResponse.chatMessage,
    },
  })

  if (llmResponse.taskCommands.length === 0) {
    return
  }

  const command = llmResponse.taskCommands.join(';')
  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c ${command}`,
    },
  })
}

async function main() {
  initEnv()

  client.setConfig({
    baseUrl: `http://${rconClientConfig.host}:${rconClientConfig.port}`,
  })

  const ws = connect(`ws://${wsClientConfig.wsHost}:${wsClientConfig.wsPort}`)

  const gameLogger = useLogg('game').useGlobalConfig()

  const messageHandler = await createMessageHandler()

  for await (const buffer of ws.source) {
    const line = Buffer.from(buffer).toString('utf-8')
    gameLogger.withContext('game').log(line)

    const chatMessage = parseChatMessage(line)
    if (chatMessage) {
      if (chatMessage.isServer) {
        continue
      }

      gameLogger.withContext('chat').log(`${chatMessage.username}: ${chatMessage.message}`)

      await executeCommandFromAgent(chatMessage, messageHandler)
      continue
    }

    const modErrorMessage = parseModErrorMessage(line)
    if (modErrorMessage) {
      gameLogger.withContext('mod').error(`${modErrorMessage.error}`)

      await executeCommandFromAgent(modErrorMessage, messageHandler)
      continue
    }

    const taskCompletedMessage = parseTaskCompletedMessage(line)
    if (taskCompletedMessage) {
      gameLogger.withContext('mod').log(`All tasks completed`)

      await executeCommandFromAgent(taskCompletedMessage, messageHandler)
      continue
    }
  }
}

main().catch((e: Error) => {
  logger.error(e.message)
  logger.error(e.stack)
})
