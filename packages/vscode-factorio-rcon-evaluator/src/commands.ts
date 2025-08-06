import type { Disposable } from 'vscode'
import type { Context } from './types'
import { Rcon } from 'rcon-client'
import { BuildMode, LuaLibImportKind, LuaTarget, transpileString } from 'typescript-to-lua'
import { commands, window } from 'vscode'
import { ConfigurationKey, getConfig } from './config'
import { commandEvaluateCode, commandEvaluateSelected } from './constants'

interface Command {
  command: string
  execute: (ctx: Context, ...args: any[]) => Promise<void>
}

const cmds: Command[] = [
  {
    command: commandEvaluateSelected,
    execute: async (ctx: Context) => {
      const channel = ctx.outputChannel
      channel.appendLine('=========================')

      const editor = window.activeTextEditor
      if (!editor) {
        window.showErrorMessage('No active text editor found.')
        return
      }

      const selectedText = editor.document.getText(editor.selection)
      if (!selectedText) {
        window.showErrorMessage('No text` selected in the editor.')
        return
      }

      commands.executeCommand(commandEvaluateCode, selectedText)
    },
  },
  {
    command: commandEvaluateCode,
    execute: async (ctx: Context, code: string) => {
      const channel = ctx.outputChannel
      channel.appendLine('=========================')

      const transpileResult = transpileString(
        code.trim(),
        {
          luaTarget: LuaTarget.LuaJIT,
          luaLibImport: LuaLibImportKind.Inline,
          buildMode: BuildMode.Default,
          noCheck: true,
          noHeader: true,
          noImplicitSelf: true,
        },
      )

      if (transpileResult.diagnostics.length > 0) {
        transpileResult.diagnostics.forEach((diagnostic) => {
          if (typeof diagnostic.messageText === 'string') {
            channel.appendLine(`Error: ${diagnostic.messageText} at ${diagnostic.start}`)
          }
          else {
            channel.appendLine(`Error: ${diagnostic.messageText.messageText} at ${diagnostic.start}`)
          }
        })

        const errMsgResult = await window.showErrorMessage(`Transpilation failed, check the output channel for details.`, 'Open Output Channel')
        if (errMsgResult === 'Open Output Channel') {
          channel.show()
        }

        return
      }

      if (!transpileResult.file || !transpileResult.file.lua) {
        window.showErrorMessage('Transpilation did not produce valid Lua code.')
        return
      }

      const codeWithLineNumbers = transpileResult.file.lua.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n')

      channel.appendLine(`Transpiled Lua code:\n ${codeWithLineNumbers}`)

      const config = await getConfig(channel)
      if (!config) {
        return
      }

      // send to Factorio RCON
      try {
        channel.appendLine(`Connecting to RCON at ${config[ConfigurationKey.rconHost]}:${config[ConfigurationKey.rconPort]}`)

        const rcon = await Rcon.connect({
          host: config[ConfigurationKey.rconHost],
          port: config[ConfigurationKey.rconPort],
          password: config[ConfigurationKey.rconPassword],
        })

        const response = await rcon.send(`/sc ${transpileResult.file.lua}`)
        channel.appendLine(`RCON Response: ${response}`)
        channel.show()

        await rcon.end()
      }
      catch (error) {
        const err = error as Error
        const msg = err.message || err.stack || 'No message or stack trace'
        channel.appendLine(err.stack || 'No stack trace')
        window.showErrorMessage(`Failed to send to RCON: ${msg}`)
      }
    },
  },
]

export function registerCommand(
  ctx: Context,
): Disposable[] {
  return cmds.map(cmd => commands.registerCommand(cmd.command, (...args) => cmd.execute(ctx, ...args)))
}
