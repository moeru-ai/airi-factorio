import type { ExtensionContext, OutputChannel } from 'vscode'
import { Rcon } from 'rcon-client'
import { BuildMode, LuaLibImportKind, LuaTarget, transpileString } from 'typescript-to-lua'
import { commands, window, workspace } from 'vscode'

async function evaluate(channel: OutputChannel) {
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

  const transpileResult = transpileString(
    selectedText.trim(),
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

  // send to Factorio RCON
  try {
    const config = workspace.getConfiguration('factorio-rcon-evaluator')
    const host = config.get<string>('rconHost', 'localhost')
    const port = config.get<number>('rconPort', 27105)
    const password = config.get<string>('rconPassword', '123456')

    channel.appendLine(`Connecting to RCON at ${host}:${port} with password ${password ? '***' : 'not set'}`)

    const rcon = await Rcon.connect({
      host,
      port,
      password,
    })

    const response = await rcon.send(`/sc ${transpileResult.file.lua}`)
    channel.appendLine(`RCON Response: ${response}`)
    channel.show()

    await rcon.end()
  }
  catch (error) {
    channel.appendLine(`Error send to RCON: ${error instanceof Error ? error.message : String(error)}`)
    window.showErrorMessage(`Failed to send to RCON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function activate(ctx: ExtensionContext) {
  const channel = window.createOutputChannel('Factorio RCON Evaluator')
  channel.appendLine('Congratulations, your extension "vscode-factorio-rcon-evaluator" is now active!')

  const disposable = commands.registerCommand('factorio-rcon-evaluator.test', () => evaluate(channel))

  ctx.subscriptions.push(disposable)
}

export function deactivate() {}
