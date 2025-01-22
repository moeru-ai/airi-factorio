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
