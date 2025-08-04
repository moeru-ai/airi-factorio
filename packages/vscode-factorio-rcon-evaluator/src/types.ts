import type { ExtensionContext, OutputChannel } from 'vscode'

export interface Context {
  extCtx: ExtensionContext
  outputChannel: OutputChannel
}
