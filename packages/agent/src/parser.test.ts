import { describe, expect, it } from 'vitest'
import { parseChatMessage, parseCommandMessage, parseModErrorMessage, parseTaskCompletedMessage } from './parser'

describe('parseCommandMessage', () => {
  it('should parse player command', () => {
    const log = `2025-02-02 11:53:37 [COMMAND] username (command): remote.call("autorio_tools", "get_inventory_items", 1)`
    const result = parseCommandMessage(log)
    expect(result).toEqual({
      username: 'username',
      command: `remote.call("autorio_tools", "get_inventory_items", 1)`,
      isServer: false,
      date: '2025-02-02',
      type: 'command',
    })
  })

  it('should parse server command', () => {
    const log = `2025-02-02 12:03:17 [COMMAND] <server> (command): remote.call(\"autorio_tools\", \"get_inventory_items\", 1)`
    const result = parseCommandMessage(log)
    expect(result).toEqual({
      username: 'server',
      command: `remote.call("autorio_tools", "get_inventory_items", 1)`,
      isServer: true,
      date: '2025-02-02',
      type: 'command',
    })
  })
})

describe('parseChatMessage', () => {
  it('should parse chat message', () => {
    const log = `2025-02-02 11:53:37 [CHAT] username: hello world`
    const result = parseChatMessage(log)
    expect(result).toEqual({
      username: 'username',
      message: 'hello world',
      isServer: false,
      date: '2025-02-02',
      type: 'chat',
    })
  })

  it('should parse server chat message', () => {
    const log = `2025-02-02 11:53:37 [CHAT] <server>: hello world`
    const result = parseChatMessage(log)
    expect(result).toEqual({
      username: 'server',
      message: 'hello world',
      isServer: true,
      date: '2025-02-02',
      type: 'chat',
    })
  })
})

describe('parseModErrorMessage', () => {
  it('should parse mod error message', () => {
    const log = `42.535 Script @__autorio__/control.lua:661: [AUTORIO] [ERROR] No iron-ore found in 50m radius, reverting to IDLE state`
    const result = parseModErrorMessage(log)
    expect(result).toEqual({
      error: 'No iron-ore found in 50m radius, reverting to IDLE state',
      serverTimestamp: '42.535',
      type: 'modError',
    })
  })
})

describe('parseTaskCompletedMessage', () => {
  it('should parse task completed message', () => {
    const log = `51.889 Script @__autorio__/control.lua:920: [AUTORIO] All tasks completed`
    const result = parseTaskCompletedMessage(log)
    expect(result).toEqual({
      serverTimestamp: '51.889',
      type: 'taskCompleted',
    })
  })
})
