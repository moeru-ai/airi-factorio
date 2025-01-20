import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { execa } from 'execa'
import { client, v2FactorioConsoleCommandMessagePost } from 'factorio-rcon-api-client'

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

  for await (const line of execa(factorioConfig.path, [
    '--start-server',
    factorioConfig.savePath,
    '--rcon-password',
    factorioConfig.rconPassword,
    '--rcon-port',
    factorioConfig.rconPort.toString(),
  ])) {
    const chatMessage = parseChatMessage(line)
    if (!chatMessage) {
      logger.log('Other message', line)

      continue
    }
    if (chatMessage.isServer) {
      continue
    }

    gameLogger.log(`[chat] ${chatMessage.username}: ${chatMessage.message}`)

    const llmResponse = await handleMessage(chatMessage.message)
    if (!llmResponse) {
      continue
    }

    v2FactorioConsoleCommandMessagePost({
      body: {
        message: llmResponse,
      },
    }).then((r: any) => {
      logger.withFields(r).debug('RCON response')
    })
  }
}

main().catch((e: Error) => {
  logger.error(e.message)
  logger.error(e.stack)
})
