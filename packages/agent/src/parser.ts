export interface ChatMessage {
  username: string
  message: string
  isServer: boolean
  date: string
}

export interface CommandMessage {
  username: string
  command: string
  isServer: boolean
  date: string
}

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
    return { username: 'server', command, isServer: true, date }
  }

  // example: 2000-01-02 12:34:56 [COMMAND] username (command): log('hello world')
  const playerRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[COMMAND\] (.+?) \(command\): (.+)/
  const playerMatch = log.match(playerRegex)

  if (playerMatch) {
    const [, date, , username, command] = playerMatch
    return { username, command, isServer: false, date }
  }

  return null
}

export function parseChatMessage(log: string): ChatMessage | null {
  // example: 2000-01-02 12:34:56 [CHAT] <server>: message
  const serverChatRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[CHAT\] <server>: (.+)/
  const serverMatch = log.match(serverChatRegex)

  if (serverMatch) {
    const [, date, , message] = serverMatch
    return { username: 'server', message, isServer: true, date }
  }

  // example: 2000-01-02 12:34:56 [CHAT] username: message
  const playerChatRegex = /(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \[CHAT\] (.+?): (.+)/
  const playerMatch = log.match(playerChatRegex)

  if (playerMatch) {
    const [, date, , username, message] = playerMatch
    return { username, message, isServer: false, date }
  }

  return null
}
