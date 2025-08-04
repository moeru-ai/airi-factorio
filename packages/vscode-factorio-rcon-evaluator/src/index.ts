import type { ExtensionContext } from 'vscode'
import { window } from 'vscode'
import { registerCommand } from './commands'
import { extensionIdentifier } from './constants'

export async function activate(extCtx: ExtensionContext) {
  const outputChannel = window.createOutputChannel('Factorio RCON Evaluator')
  const context = {
    extCtx,
    outputChannel,
  }

  extCtx.subscriptions.push(
    ...registerCommand(context),
  )

  outputChannel.appendLine(`Congratulations, your extension "${extensionIdentifier}" is now active!`)
}

export function deactivate() {}
