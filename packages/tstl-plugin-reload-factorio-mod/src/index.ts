import type * as tstl from 'typescript-to-lua'
import { env } from 'node:process'
import { Format, setGlobalFormat, useLogg } from '@guiiai/logg'
import { client, v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'

const rconApiServerHost = env.RCON_API_SERVER_HOST
const rconApiServerPort = env.RCON_API_SERVER_PORT

client.setConfig({
  baseUrl: `http://${rconApiServerHost}:${rconApiServerPort}`,
})

setGlobalFormat(Format.Pretty)
const logger = useLogg('tstl-plugin-reload-factorio-mod').useGlobalConfig()

async function reloadMod(result: tstl.EmitFile[]) {
  if (!rconApiServerHost) {
    logger.warn('RCON_API_SERVER_HOST is not set, plugin will not work')
    return
  }

  const example = result.find(file => file.outputPath.endsWith('control.lua'))
  if (!example) {
    logger.warn('example control.ts not found')
    return
  }

  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c remote.call('example_mod', 'before_reload')`,
    },
  })

  for (const line of example.code.split('\n')) {
    await v2FactorioConsoleCommandRawPost({
      body: {
        input: `/c remote.call('example_mod', 'append_code_to_reload', '${line}')`,
      },
    })
  }

  await v2FactorioConsoleCommandRawPost({
    body: {
      input: `/c remote.call('example_mod', 'reload_code')`,
    },
  })
}

const plugin: tstl.Plugin = {
  afterEmit: (_1, _2, _3, result) => {
    reloadMod(result).then(() => {
      logger.log('reload mod success')
    }).catch((err) => {
      logger.withFields({ err }).error('reload mod error')
    })
  },
}

export default plugin
