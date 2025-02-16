import { createLogg } from '@guiiai/logg'
import { v2FactorioConsoleCommandRawPost } from 'factorio-rcon-api-client'
import { z } from 'zod'

const logger = createLogg('tools').useGlobalConfig()

interface ToolFunction {
  name: string
  description: string
  schema: z.Schema
  fn: (args: any) => Promise<any>
}

export const tools: ToolFunction[] = [
  {
    name: 'getInventoryItems',
    description: 'Get the items in the player\'s inventory',
    schema: z.object({}),
    fn: async () => {
      const response = await v2FactorioConsoleCommandRawPost({ body: { input: '/c remote.call("autorio_tools", "get_inventory_items", 1)' } })
      logger.withFields({ response: response.data.output }).debug('Inventory items')
      return response.data.output
    },
  },
  {
    name: 'getRecipe',
    description: 'Get the recipe for a given item',
    schema: z.object({
      item: z.string().describe('The item to get the recipe for'),
    }),
    fn: async ({ parameters }) => {
      logger.withFields(parameters).debug('Try to get recipe for item')

      const response = await v2FactorioConsoleCommandRawPost({ body: { input: `/c remote.call("autorio_tools", "get_recipe", "${parameters.item}", 1)` } })
      logger.withFields({ response: response.data.output }).debug('Recipe')
      return response.data.output
    },
  },
  {
    // TODO:
    // Is this meaningful?
    // When we call LLM, it already has a delay because of the latency of the network and the time cost of the LLM.
    name: 'wait',
    description: 'Wait for a given amount of time',
    schema: z.object({
      seconds: z.number()
        .min(0.1, 'Can not wait for less than 0.1 second, it will be meaningless')
        .max(10, 'Can not wait for more than 10 seconds, it will cause the agent to be stuck')
        .describe('The amount of time to wait in seconds, unit is second'),
    }),
    fn: async ({ parameters }) => {
      await new Promise(resolve => setTimeout(resolve, parameters.seconds * 1000))
    },
  },
]
