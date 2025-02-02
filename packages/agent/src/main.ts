import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { execa } from 'execa'
import { client, v2FactorioConsoleCommandMessagePost, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'

import { factorioConfig, initEnv, rconClientConfig } from './config'
import { handleMessage } from './message-handler'
import { parseChatMessage } from './parser'

setGlobalFormat(Format.Pretty)
const logger = useLogg('main').useGlobalConfig()

async function main() {
  initEnv()

  client.setConfig({
    baseUrl: `http://${rconClientConfig.host}:${rconClientConfig.port}`,
  })

  const gameLogger = useLogg('game').useGlobalConfig()

  // TODO: how to restart factorio when mod changes? And is this necessary?
  const factorioInst = execa(factorioConfig.path, [
    '--start-server',
    factorioConfig.savePath,
    '--rcon-password',
    factorioConfig.rconPassword,
    '--rcon-port',
    factorioConfig.rconPort.toString(),
  ], {
    stdout: ['pipe', 'inherit'],
  })

  for await (const line of factorioInst.iterable()) {
    const chatMessage = parseChatMessage(line)

    if (!chatMessage) {
      continue
    }
    if (chatMessage.isServer) {
      continue
    }

    gameLogger.withContext('chat').log(`${chatMessage.username}: ${chatMessage.message}`)

    const llmResponse = await handleMessage(chatMessage.message)
    if (!llmResponse) {
      logger.error('Failed to handle message')
      continue
    }

    await v2FactorioConsoleCommandMessagePost({
      body: {
        message: llmResponse.taskDescription,
      },
    })

    const command = llmResponse.taskCommands.join(';')
    await v2FactorioConsoleCommandRawPost({
      body: {
        input: `/c ${command}`,
      },
    })
  }
}

main().catch((e: Error) => {
  logger.error(e.message)
  logger.error(e.stack)
})
