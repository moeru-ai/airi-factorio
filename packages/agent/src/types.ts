export interface OpenAIConfig {
  apiKey: string
  baseUrl: string
}

export interface FactorioConfig {
  path: string
  savePath: string
  rconPassword: string
  rconPort: number
  rconServerHost: string
}

export interface RconAPIClientConfig {
  port: number
  host: string
}
