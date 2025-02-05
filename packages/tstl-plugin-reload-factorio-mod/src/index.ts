import type * as tstl from 'typescript-to-lua'
import { env } from 'node:process'
import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { client, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'

const rconApiServerHost = env.RCON_API_SERVER_HOST
const rconApiServerPort = env.RCON_API_SERVER_PORT
const modName = env.FACTORIO_MOD_NAME

client.setConfig({
  baseUrl: `http://${rconApiServerHost}:${rconApiServerPort}`,
})

setGlobalFormat(Format.Pretty)
const logger = useLogg('tstl-plugin-reload-factorio-mod').useGlobalConfig()

async function reloadMod(result: tstl.EmitFile[], modName: string) {
  const mod = result.find(file => file.outputPath.endsWith('control.lua'))
  if (!mod) {
    logger.warn(`${modName} control.ts not found`)
    return
  }

  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c remote.call('${modName}_hot_reload', 'before_reload')`,
    },
  })

  for (const line of mod.code.split('\n')) {
    await v2FactorioConsoleCommandRawPost({
      body: {
        input: `/c remote.call('${modName}_hot_reload', 'append_code_to_reload', '${line}')`,
      },
    })
  }

  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c remote.call('${modName}_hot_reload', 'reload_code')`,
    },
  })
}

const plugin: tstl.Plugin = {
  afterEmit: (_1, _2, _3, result) => {
    if (!rconApiServerHost) {
      logger.warn('RCON_API_SERVER_HOST is not set, plugin will not work')
      return
    }

    if (!rconApiServerPort) {
      logger.warn('RCON_API_SERVER_PORT is not set, plugin will not work')
      return
    }

    if (!modName) {
      logger.warn('FACTORIO_MOD_NAME is not set, plugin will not work')
      return
    }

    reloadMod(result, modName).then(() => {
      logger.log('reload mod success')
    }).catch((err) => {
      logger.withFields({ err }).error('reload mod error')
    })
  },
}

export default plugin
