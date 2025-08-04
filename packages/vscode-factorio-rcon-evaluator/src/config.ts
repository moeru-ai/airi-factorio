import type { OutputChannel } from 'vscode'
import { commands, window, workspace } from 'vscode'
import { extensionIdentifier } from './constants'

export enum ConfigurationKey {
  rconHost = 'rconHost',
  rconPort = 'rconPort',
  rconPassword = 'rconPassword',
}

async function showConfigureErrorMessage(key: ConfigurationKey) {
  const result = await window.showErrorMessage(`No ${key} configured.`, 'Open Settings')
  if (result !== 'Open Settings') {
    return
  }

  commands.executeCommand('workbench.action.openSettings', `${extensionIdentifier}.${key}`)
}

export async function getConfig(channel: OutputChannel) {
  const workspaceConfig = workspace.getConfiguration()

  const rconHost = workspaceConfig.get<string>(ConfigurationKey.rconHost)
  if (!rconHost) {
    channel.appendLine('No rconHost configured.')
    await showConfigureErrorMessage(ConfigurationKey.rconHost)
    return
  }

  const rconPort = workspaceConfig.get<number>(ConfigurationKey.rconPort)
  if (!rconPort) {
    channel.appendLine('No rconPort configured.')
    await showConfigureErrorMessage(ConfigurationKey.rconPort)
    return
  }

  const rconPassword = workspaceConfig.get<string>(ConfigurationKey.rconPassword)
  if (!rconPassword) {
    channel.appendLine('No rconPassword configured.')
    await showConfigureErrorMessage(ConfigurationKey.rconPassword)
    return
  }

  return {
    [ConfigurationKey.rconHost]: rconHost,
    [ConfigurationKey.rconPort]: rconPort,
    [ConfigurationKey.rconPassword]: rconPassword,
  }
}
