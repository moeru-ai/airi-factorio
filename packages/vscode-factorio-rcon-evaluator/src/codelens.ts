import type { CancellationToken, CodeLensProvider, Disposable, DocumentSymbol, TextDocument } from 'vscode'
import type { Context } from './types'
import { Project } from 'ts-morph'
import { CodeLens, commands, languages, SymbolKind } from 'vscode'
import { commandEvaluateCode } from './constants'

/**
 * Get the content of a function from the code.
 *
 * Example:
 * ```typescript
 * function rconScript() {
 *   log('Hello, world!')
 * }
 * ```
 *
 * Result:
 * ```typescript
 * log('Hello, world!')
 * ```
 */
export function getFunctionContent(code: string, symbol: DocumentSymbol) {
  const project = new Project()
  const sourceFile = project.createSourceFile(symbol.name, code)
  const functionDeclarations = sourceFile.getFunctions()
  if (functionDeclarations.length === 0) {
    return undefined
  }

  return functionDeclarations[0].getBodyText()
}

export class EvaluatorCodeLensProvider implements CodeLensProvider {
  #ctx: Context

  constructor(ctx: Context) {
    this.#ctx = ctx
  }

  async provideCodeLenses(document: TextDocument, _: CancellationToken) {
    if (document.languageId !== 'typescript') {
      return []
    }

    const symbols = await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri)
    return symbols.filter(it => it.kind === SymbolKind.Function && it.name.startsWith('rconScript'))
      .map<CodeLens | null>((it) => {
        const content = getFunctionContent(document.getText(it.range), it)
        if (!content) {
          return null
        }

        return new CodeLens(it.range, {
          title: 'Factorio RCON: Evaluate',
          command: commandEvaluateCode,
          arguments: [content],
        })
      })
      .filter(it => it !== null)
  }
}

export function registerCodeLens(ctx: Context): Disposable[] {
  return [
    languages.registerCodeLensProvider({ language: 'typescript' }, new EvaluatorCodeLensProvider(ctx)),
  ]
}
