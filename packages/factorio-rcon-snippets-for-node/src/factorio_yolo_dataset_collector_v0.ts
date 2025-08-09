import { readFile } from 'node:fs/promises'
import { env } from 'node:process'
import { Rcon } from 'rcon-client'
import { BuildMode, LuaLibImportKind, LuaTarget, transpileString } from 'typescript-to-lua'

async function main() {
  const rconPort = env.RCON_PORT
  const rconHost = env.RCON_HOST
  const rconPassword = env.RCON_PASSWORD

  const seed = '2913363151'

  if (!rconPort || !rconHost || !rconPassword) {
    throw new Error('RCON_PORT, RCON_HOST, and RCON_PASSWORD must be set')
  }

  const codePath = new URL(
    '../../factorio-rcon-snippets-for-vscode/src/factorio_yolo_dataset_collector_v0.ts',
    import.meta.url,
  )

  const code = (await readFile(codePath)).toString()

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
        console.error(`Error: ${diagnostic.messageText} at ${diagnostic.start}`)
      }
      else {
        console.error(`Error: ${diagnostic.messageText.messageText} at ${diagnostic.start}`)
      }
    })

    return
  }

  if (!transpileResult.file || !transpileResult.file.lua) {
    throw new Error('Transpilation did not produce valid Lua code.')
  }

  const entitiesNames = [
    'assembling-machine-1',
    'assembling-machine-2',
    'assembling-machine-3',
    'transport-belt',
    'fast-transport-belt',
    'express-transport-belt',
  ]

  const rconConnection = await Rcon.connect({
    host: rconHost,
    port: Number(rconPort),
    password: rconPassword,
  })

  let scriptFirstRun = true
  for (const index in entitiesNames) {
    const name = entitiesNames[index]
    await rconConnection.send(`/sc helpers.write_file('factorio_yolo_dataset_v0/classes.txt', '${name}\n', true)`)

    let firstRun = true
    for (let i = 0; i < 20; i++) {
      const type = i > 18 ? 'test' : i > 14 ? 'val' : 'train'
      // remove the last line 'return ____exports'
      let codeWithParams = transpileResult.file.lua.toString()
      codeWithParams = codeWithParams.replace(/return ____exports/, '')
      codeWithParams += `\n\n____exports.main('${name}', ${index}, '${seed}', ${scriptFirstRun}, ${firstRun}, '${type}')`
      const response = await rconConnection.send(`/sc ${codeWithParams}`)
      // eslint-disable-next-line no-console
      console.log(response)
      scriptFirstRun = false
      firstRun = false
    }
  }

  await rconConnection.end()
}

main().then()
