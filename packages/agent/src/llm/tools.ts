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
      logger.withFields({ response }).debug('Inventory items')
      return response.data.output
    },
  },
  {
    name: 'getRecipe',
    description: 'Get the recipe for a given item',
    schema: z.object({}),
    fn: async (p) => {
      logger.withFields(p).debug('Try to get recipe for item')

      const response = await v2FactorioConsoleCommandRawPost({ body: { input: `/c remote.call("autorio_tools", "get_recipe", "${p.item}", 1)` } })
      logger.withFields({ response }).debug('Recipe')
      return response.data.output
    },
  },
]
