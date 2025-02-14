import type { ResultPromise } from 'execa'
import type { MessageHandler } from './llm/message-handler'
import type { StdoutMessage } from './parser'
import { arch } from 'node:os'
import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'

import { execa } from 'execa'
import { client, v2FactorioConsoleCommandMessagePost, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'
import { factorioConfig, initEnv, rconClientConfig } from './config'
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

  const gameLogger = useLogg('game').useGlobalConfig()

  // TODO: create a http server to receive mod change signal and restart factorio
  let factorioInst: ResultPromise<{
    stdout: ('pipe' | 'inherit')[]
  }>

  if (arch() === 'arm64') {
    factorioInst = execa('/bin/box64', [
      factorioConfig.path,
      '--start-server',
      factorioConfig.savePath,
      '--rcon-password',
      factorioConfig.rconPassword,
      '--rcon-port',
      factorioConfig.rconPort.toString(),
    ], {
      stdout: ['pipe', 'inherit'],
    })
  }
  else {
    factorioInst = execa(factorioConfig.path, [
      '--start-server',
      factorioConfig.savePath,
      '--rcon-password',
      factorioConfig.rconPassword,
      '--rcon-port',
      factorioConfig.rconPort.toString(),
    ], {
      stdout: ['pipe', 'inherit'],
    })
  }

  const messageHandler = await createMessageHandler()

  for await (const line of factorioInst.iterable()) {
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
