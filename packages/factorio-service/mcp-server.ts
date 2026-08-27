import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Rcon } from 'rcon-client'

async function run() {
  const rcon = await Rcon.connect({
    host: '127.0.0.1',
    port: 27015,
    password: 'airi_secret_pass'
  })

  const server = new Server({ name: 'factorio-tools', version: '1.0.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'factorio_execute_rcon',
        description: 'Execute Lua code in Factorio via RCON. Use this to check inventory, resources, or manage the base (e.g. /c rcon.print(game.player.get_main_inventory().get_contents())).',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The exact Lua command to run, starting with /c' },
          },
          required: ['command'],
        },
      }
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    if (name === 'factorio_execute_rcon') {
      const command = args?.command as string
      try {
        const response = await rcon.send(command)
        return { content: [{ type: 'text', text: response || 'Command executed successfully.' }] }
      } catch (e: any) {
        return { content: [{ type: 'text', text: `Error executing command: ${e.message}` }] }
      }
    }
    throw new Error(`Tool ${name} not found`)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

run().catch(console.error)