export interface InventoryItem {
  name: string
  count: number
}

export function get_inventory_items(player_id: number): InventoryItem[] {
  const player = game.connected_players[player_id - 1]

  const main_inventory = player.get_main_inventory()
  if (!main_inventory) {
    return []
  }

  return main_inventory.get_contents().map(({ name, count }) => ({ name, count }))
}
