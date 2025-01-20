export interface ChatMessage {
  username: string
  message: string
  isServer: boolean
  date: string
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
