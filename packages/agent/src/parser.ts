export interface ChatMessage {
  type: 'chat'
  username: string
  message: string
  isServer: boolean
  date: string
}

export interface CommandMessage {
  type: 'command'
  username: string
  command: string
  isServer: boolean
  date: string
}

export interface ModErrorMessage {
  type: 'modError'
  serverTimestamp: string
  error: string
}

export interface TaskCompletedMessage {
  type: 'taskCompleted'
  serverTimestamp: string
}

export type StdoutMessage = ChatMessage | CommandMessage | ModErrorMessage | TaskCompletedMessage

export interface LLMMessage {
  chatMessage: string
  taskCommands: string[]
}

export function parseLLMMessage(message: string): LLMMessage {
  return JSON.parse(message) as LLMMessage
}

export function parseCommandMessage(log: string): CommandMessage | null {
  // example: 2025-02-02 12:08:24 [COMMAND] <server> (command): remote.call(\"autorio_tools\", \"get_recipe\", \"iron-chest\", 1)
  const serverRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[COMMAND\] <server> \(command\): (.+)/
  const serverMatch = log.match(serverRegex)

  if (serverMatch) {
    const [, date, , command] = serverMatch
    return { username: 'server', command, isServer: true, date, type: 'command' }
  }

  // example: 2000-01-02 12:34:56 [COMMAND] username (command): log('hello world')
  const playerRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[COMMAND\] (.+?) \(command\): (.+)/
  const playerMatch = log.match(playerRegex)

  if (playerMatch) {
    const [, date, , username, command] = playerMatch
    return { username, command, isServer: false, date, type: 'command' }
  }

  return null
}

export function parseChatMessage(log: string): ChatMessage | null {
  // example: 2000-01-02 12:34:56 [CHAT] <server>: message
  const serverChatRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[CHAT\] <server>: (.+)/
  const serverMatch = log.match(serverChatRegex)

  if (serverMatch) {
    const [, date, , message] = serverMatch
    return { username: 'server', message, isServer: true, date, type: 'chat' }
  }

  // example: 2000-01-02 12:34:56 [CHAT] username: message
  const playerChatRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[CHAT\] (.+?): (.+)/
  const playerMatch = log.match(playerChatRegex)

  if (playerMatch) {
    const [, date, , username, message] = playerMatch
    return { username, message, isServer: false, date, type: 'chat' }
  }

  return null
}

export function parseModErrorMessage(log: string): ModErrorMessage | null {
  // example: 42.535 Script @__autorio__/control.lua:661: [AUTORIO] [ERROR] No iron-ore found in 50m radius, reverting to IDLE state
  const modErrorRegex = /(\d+\.\d{3}) Script @__autorio__\/control\.lua:(\d+): \[AUTORIO\] \[ERROR\] (.+)/
  const modErrorMatch = log.match(modErrorRegex)

  if (modErrorMatch) {
    const [,serverTimestamp, , error] = modErrorMatch
    return { serverTimestamp, error, type: 'modError' }
  }

  return null
}

export function parseTaskCompletedMessage(log: string): TaskCompletedMessage | null {
  // example: 51.889 Script @__autorio__/control.lua:920: [AUTORIO] All tasks completed
  const taskCompletedRegex = /(\d+\.\d{3}) Script @__autorio__\/control\.lua:(\d+): \[AUTORIO\] All tasks completed/
  const taskCompletedMatch = log.match(taskCompletedRegex)

  if (taskCompletedMatch) {
    const [, serverTimestamp] = taskCompletedMatch
    return { serverTimestamp, type: 'taskCompleted' }
  }

  return null
}
