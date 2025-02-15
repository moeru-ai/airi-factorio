import type { FactorioConfig, WsServerConfig } from './types'
import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('config').useGlobalConfig()

export const wsServerConfig: WsServerConfig = {
  host: '',
  port: 0,
}

export const factorioConfig: FactorioConfig = {
  path: '',
  savePath: '',
  rconPassword: '',
  rconPort: 0,
}

export function initEnv() {
  logger.log('Initializing environment variables')

  factorioConfig.path = env.FACTORIO_PATH || ''
  factorioConfig.savePath = env.FACTORIO_SAVE_PATH || ''
  factorioConfig.rconPassword = env.FACTORIO_RCON_PASSWORD || ''
  factorioConfig.rconPort = Number.parseInt(env.FACTORIO_RCON_PORT || '27015')

  wsServerConfig.host = env.WS_SERVER_HOST || 'localhost'
  wsServerConfig.port = Number.parseInt(env.WS_SERVER_PORT || '8080')

  logger.withFields({ factorioConfig }).log('Environment variables initialized')
}
