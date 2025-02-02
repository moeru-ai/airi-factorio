import { describe, expect, it } from 'vitest'
import { parseChatMessage, parseCommandMessage } from './parser'

describe('parseCommandMessage', () => {
  it('should parse player command', () => {
    const log = `2025-02-02 11:53:37 [COMMAND] username (command): remote.call("autorio_tools", "get_inventory_items", 1)`
    const result = parseCommandMessage(log)
    expect(result).toEqual({ username: 'username', command: `remote.call("autorio_tools", "get_inventory_items", 1)`, isServer: false, date: '2025-02-02' })
  })

  it('should parse server command', () => {
    const log = `2025-02-02 12:03:17 [COMMAND] <server> (command): remote.call(\"autorio_tools\", \"get_inventory_items\", 1)`
    const result = parseCommandMessage(log)
    expect(result).toEqual({ username: 'server', command: `remote.call("autorio_tools", "get_inventory_items", 1)`, isServer: true, date: '2025-02-02' })
  })
})

describe('parseChatMessage', () => {
  it('should parse chat message', () => {
    const log = `2025-02-02 11:53:37 [CHAT] username: hello world`
    const result = parseChatMessage(log)
    expect(result).toEqual({ username: 'username', message: 'hello world', isServer: false, date: '2025-02-02' })
  })

  it('shoukd parse server chat message', () => {
    const log = `2025-02-02 11:53:37 [CHAT] <server>: hello world`
    const result = parseChatMessage(log)
    expect(result).toEqual({ username: 'server', message: 'hello world', isServer: true, date: '2025-02-02' })
  })
})
