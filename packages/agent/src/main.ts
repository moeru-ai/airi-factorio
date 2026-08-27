import { ProxyAgent, setGlobalDispatcher } from 'undici'

setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:2080'))

import type { MessageHandler } from './llm/message-handler'
import type { StdoutMessage } from './parser'
import { Buffer } from 'node:buffer'
import { Socket } from 'node:net'
import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { backOff } from 'exponential-backoff'
import { client, v2FactorioConsoleCommandMessagePost, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'
import { connect } from 'it-ws'
import { initEnv, rconClientConfig, wsClientConfig } from './config'
import { createMessageHandler } from './llm/message-handler'
import { parseChatMessage, parseModErrorMessage, parseOperationCompletedMessage } from './parser'

setGlobalFormat(Format.Pretty)
const logger = useLogg('main').useGlobalConfig()

function checkPortReady(host: string, port: number, timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket()
    socket.setTimeout(timeout)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

async function waitForServer(host: string, port: number, retries = 60, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const ready = await checkPortReady(host, port)
    if (ready) {
      logger.log(`Connected to Factorio server bridge at ${host}:${port}!`)
      return
    }
    logger.log(`[agent] Waiting for Factorio server (${host}:${port})... (${i + 1}/${retries})`)
    await new Promise(res => setTimeout(res, delay))
  }
  throw new Error(`Failed to connect to Factorio server on ${host}:${port} after ${retries} retries.`)
}

async function executeCommandFromAgent<T extends StdoutMessage>(message: T, messageHandler: MessageHandler) {
  const llmResponse = await backOff(() => messageHandler.handleMessage(message), {
    timeMultiple: 2,
    maxDelay: 10000,
    retry(e, attemptNumber) {
      logger.withFields({ error: e.message, attemptNumber }).error('Failed to handle message, attempt to retry')
      return true
    },
  })

  if (!llmResponse) {
    logger.error('Failed to handle message')
    return
  }

  await v2FactorioConsoleCommandMessagePost({
    body: {
      message: llmResponse.chatMessage,
    },
  })

  if (llmResponse.operationCommands.length === 0) {
    return
  }

  logger.withFields({ operationCommands: llmResponse.operationCommands, currentStep: llmResponse.currentStep }).debug('Executing operation commands')

  const command = llmResponse.operationCommands.join(';')
  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c ${command}`,
    },
  })
}

async function main() {
  initEnv()

  await waitForServer(wsClientConfig.wsHost || 'localhost', wsClientConfig.wsPort)

  client.setConfig({
    baseUrl: `http://${rconClientConfig.host}:${rconClientConfig.port}`,
  })

  const ws = connect(`ws://${wsClientConfig.wsHost}:${wsClientConfig.wsPort}`)

  const gameLogger = useLogg('game').useGlobalConfig()

  const messageHandler = await createMessageHandler()

  for await (const buffer of ws.source) {
    const line = Buffer.from(buffer).toString('utf-8')

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

    const operationCompletedMessage = parseOperationCompletedMessage(line)
    if (operationCompletedMessage) {
      gameLogger.withContext('mod').log(`All operations completed`)

      await executeCommandFromAgent(operationCompletedMessage, messageHandler)
      continue
    }
  }
}

main().catch((e: Error) => {
  logger.error(e.message)
  logger.error(e.stack)
})