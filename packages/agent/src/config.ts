import type { FactorioConfig, OpenAIConfig, RconAPIClientConfig } from './types.js'
import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('config').useGlobalConfig()

export const openaiConfig: OpenAIConfig = {
  apiKey: '',
  baseUrl: '',
}

export const factorioConfig: FactorioConfig = {
  path: '',
  savePath: '',
  rconPassword: '',
  rconPort: 0,
  rconServerHost: '',
}

export const rconClientConfig: RconAPIClientConfig = {
  host: '',
  port: 0,
}

export function initEnv() {
  logger.log('Initializing environment variables')

  openaiConfig.apiKey = env.OPENAI_API_KEY || ''
  openaiConfig.baseUrl = env.OPENAI_API_BASEURL || ''

  factorioConfig.path = env.FACTORIO_PATH || ''
  factorioConfig.savePath = env.FACTORIO_SAVE_PATH || ''
  factorioConfig.rconPassword = env.FACTORIO_RCON_PASSWORD || ''
  factorioConfig.rconPort = Number.parseInt(env.FACTORIO_RCON_PORT || '27015')
  factorioConfig.rconServerHost = env.FACTORIO_RCON_SERVER_HOST || 'localhost'

  rconClientConfig.host = env.RCON_API_SERVER_HOST || 'localhost'
  rconClientConfig.port = Number.parseInt(env.RCON_API_SERVER_PORT || '24180')

  logger.withFields({ openaiConfig }).log('Environment variables initialized')
}
