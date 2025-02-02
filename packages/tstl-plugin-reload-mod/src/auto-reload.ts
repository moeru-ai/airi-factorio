import type * as tstl from 'typescript-to-lua'

const plugin: tstl.Plugin = {
  afterEmit: (program, options, emitHost, result) => {
    const example = result.find(file => file.outputPath.endsWith('control.ts'))
    console.log('afterEmit', example?.code)
  },
}

export default plugin
