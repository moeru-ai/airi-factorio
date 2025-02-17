import type { MapPosition, MapPositionStruct } from 'factorio:prototype'
import type {
  BoundingBoxArray,
  CollisionMask,
  EquipmentPosition,
  LuaEntity,
  LuaInventory,
  LuaPlayer,
  OnPlayerCraftedItemEvent,
  OnPlayerMinedEntityEvent,
  OnScriptPathRequestFinishedEvent,
  OnSelectedEntityChangedEvent,
  PathfinderWaypoint,
  SurfaceCreateEntity,
} from 'factorio:runtime'

import type { InventoryItem } from './utils/inventory'
import { new_task_manager } from './task_manager'
import { create_tools_remote_interface } from './tools'
import { TaskStates } from './types'
import { get_inventory_items } from './utils/inventory'
import { distance } from './utils/math'

create_tools_remote_interface()

let setup_complete = false

const task_manager = new_task_manager()

function log_player_info(player_id: number) {
  // compact for lua array index
  const player = game.connected_players[player_id - 1]
  const log_data: {
    name: string
    position: MapPosition
    force: string
    inventory: InventoryItem[]
    equipment: { name: string, position: EquipmentPosition }[]
    nearby_entities: { name: string, position: MapPosition }[]
    map_info: {
      surface_name: string
      daytime: number
      wind_speed: number
      wind_orientation: number
    }
    research: {
      current_research: string
      research_progress: number
    }
    technologies: string[]
    crafting_queue: { name: string, count: number }[]
    character_stats: {
      health: number | undefined
      health_max: number
      mining_progress: number | undefined
      mining_target: LuaEntity | undefined
      vehicle: string
    }
  } = {
    name: player.name,
    position: player.position,
    force: player.force.name,
    inventory: [],
    equipment: [],
    nearby_entities: [],
    map_info: {
      surface_name: player.surface.name,
      daytime: player.surface.daytime,
      wind_speed: player.surface.wind_speed,
      wind_orientation: player.surface.wind_orientation,
    },
    research: {
      current_research: player.force.current_research?.name ?? 'None',
      research_progress: player.force.research_progress,
    },
    technologies: [],
    crafting_queue: [],
    character_stats: {
      health: undefined,
      health_max: 0,
      mining_progress: undefined,
      mining_target: undefined,
      vehicle: 'None',
    },
  }

  log_data.inventory = get_inventory_items(player_id)

  if (player.character?.grid) {
    player.character.grid.equipment.forEach(({ name, position }) => {
      log_data.equipment.push({ name, position })
    })
  }

  const nearby_entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: 20,
  })
  nearby_entities.forEach(({ name, position }) => {
    log_data.nearby_entities.push({ name, position })
  })

  for (const [name, tech] of pairs(player.force.technologies)) {
    if (tech.researched) {
      log_data.technologies.push(name)
    }
  }

  for (let i = 1; i < player.crafting_queue_size; i++) {
    const item = player.crafting_queue?.[i]
    if (item) {
      log_data.crafting_queue.push({ name: item.recipe, count: item.count })
    }
  }

  if (player.character) {
    log_data.character_stats = {
      health: player.character.health,
      health_max: player.character.max_health,
      mining_progress: player.character.mining_progress,
      mining_target: player.character.mining_target,
      vehicle: player.vehicle?.name ?? 'None',
    }
  }

  log(`[AUTORIO] Player ${player.name} info: ${serpent.block(log_data)}`)
}

remote.add_interface('autorio_operations', {
  walk_to_entity: (entity_name: string, search_radius: number) => {
    log(`[AUTORIO] New walk_to_entity task: ${entity_name}, radius: ${search_radius}`)
    task_manager.add_task({
      type: TaskStates.WALKING_TO_ENTITY,
      entity_name,
      search_radius,
      path: null,
      path_drawn: false,
      path_index: 1,
      calculating_path: false,
      target_position: null,
    })

    return true
  },

  mine_entity: (entity_name: string, count: number = 1) => {
    task_manager.add_task({
      type: TaskStates.MINING,
      entity_name,
      count,
    })

    log(`[AUTORIO] New mine_entity task: ${entity_name} x${count}`)
    return true
  },
  place_entity: (entity_name: string) => {
    task_manager.add_task({
      type: TaskStates.PLACING,
      entity_name,
      position: undefined,
    })

    log(`[AUTORIO] New place_entity task: ${entity_name}`)
    return true
  },
  move_items: (item_name: string, entity_name: string, max_count: number, to_entity: boolean): [boolean, string] => {
    task_manager.add_task({
      type: TaskStates.MOVING_ITEMS,
      item_name,
      entity_name,
      max_count: max_count || math.huge,
      to_entity,
    })

    if (to_entity) {
      log(`[AUTORIO] New move_items task for ${item_name} from player's inventory to ${entity_name}`)
    }
    else {
      log(`[AUTORIO] New move_items task for ${item_name} from ${entity_name} to player's inventory`)
    }

    return [true, 'Task started']
  },
  wait: (ticks: number): [boolean, string] => {
    task_manager.add_task({
      type: TaskStates.WAITING,
      remaining_ticks: ticks,
    })

    log(`[AUTORIO] New wait task for ${ticks} ticks`)

    return [true, 'Task started']
  },
  craft_item: (item_name: string, count: number = 1): [boolean, string] => {
    const player = game.connected_players[0]
    if (!player.force.recipes[item_name]) {
      log('[AUTORIO] Cannot start craft_item task: Recipe not available')
      return [false, 'Recipe not available']
    }
    if (!player.force.recipes[item_name].enabled) {
      log('[AUTORIO] Cannot start craft_item task: Recipe not unlocked')
      return [false, 'Recipe not unlocked']
    }

    if (!check_can_craft(player, item_name, count)) {
      return [false, 'Not enough ingredients']
    }

    task_manager.add_task({
      type: TaskStates.CRAFTING,
      item_name,
      count,
      crafted: 0,
    })

    log(`[AUTORIO] New craft_item task: ${item_name} x${count}`)
    return [true, 'Task started']
  },
  attack_nearest_enemy: (search_radius: number = 50): [boolean, string] => {
    task_manager.add_task({
      type: TaskStates.ATTACKING,
      search_radius,
      target: null,
    })

    log(`[AUTORIO] New attack nearest enemy task, search radius: ${search_radius}`)
    return [true, 'Task started']
  },
  research_technology: (technology_name: string): [boolean, string] => {
    const player = game.connected_players[0]
    const force = player.force
    const tech = force.technologies[technology_name]

    if (!tech) {
      log('[AUTORIO] Cannot start research_technology task: Technology not found')
      return [false, 'Technology not found']
    }

    if (tech.researched) {
      log('[AUTORIO] Cannot start research_technology task: Technology already researched')
      return [false, 'Technology already researched']
    }

    if (!tech.enabled) {
      log('[AUTORIO] Cannot start research_technology task: Technology not available for research')
      return [false, 'Technology not available for research']
    }

    const research_added = force.add_research(tech)
    if (research_added) {
      log(`[AUTORIO] New research_technology task: ${technology_name}`)
      return [true, 'Research started']
    }
    log('[AUTORIO] Could not start new research.')
    return [true, 'Cannot start new research.']
  },
  cancel_all_tasks: () => {
    task_manager.cancel_all_tasks()
    return true
  },
  log_player_info: (player_id: number) => {
    log_player_info(player_id)
    return true
  },
})

function get_direction(start_position: MapPositionStruct, end_position: MapPositionStruct) {
  const angle = math.atan2(end_position.y - start_position.y, start_position.x - end_position.x)
  const octant = (angle + math.pi) / (2 * math.pi) * 8 + 0.5

  if (octant < 1) {
    return defines.direction.east
  }
  if (octant < 2) {
    return defines.direction.northeast
  }
  if (octant < 3) {
    return defines.direction.north
  }
  if (octant < 4) {
    return defines.direction.northwest
  }
  if (octant < 5) {
    return defines.direction.west
  }
  if (octant < 6) {
    return defines.direction.southwest
  }
  if (octant < 7) {
    return defines.direction.south
  }
  return defines.direction.southeast
}

function get_nearest_entity(player: LuaPlayer, entities: LuaEntity[]) {
  let min_distance = math.huge
  let nearest_entity: LuaEntity | null = null

  if (entities.length === 0) {
    return null
  }

  for (const entity of entities) {
    const distance = (entity.position.x - player.position.x) ** 2 + (entity.position.y - player.position.y) ** 2
    if (distance < min_distance) {
      min_distance = distance
      nearest_entity = entity
    }
  }

  return nearest_entity
}

function start_mining(player: LuaPlayer, entity_position: MapPositionStruct) {
  player.update_selected_entity(entity_position)
  player.mining_state = { mining: true, position: entity_position } // should not use player.mine_entity() because it will skip the mining animation
  log(`[AUTORIO] Started mining at position: ${serpent.line(entity_position)}`)
}

// FIXME: who are changing the selected entity while mining?
// This only happens in multiplayer, why?
script.on_event(defines.events.on_selected_entity_changed, (unused_event: OnSelectedEntityChangedEvent) => {})

script.on_event(defines.events.on_script_path_request_finished, (event: OnScriptPathRequestFinishedEvent) => {
  if (task_manager.player_state.task_state !== TaskStates.WALKING_TO_ENTITY) {
    log('[AUTORIO] Not walking to entity, ignoring path request')
    return
  }

  if (!task_manager.player_state.parameters_walk_to_entity) {
    log('[AUTORIO] No parameters found when receiving path request')
    return
  }

  if (!event.path) {
    log('[AUTORIO] Path calculation failed, switching to direct walking')
    task_manager.player_state.task_state = TaskStates.WALKING_DIRECT
    task_manager.player_state.parameters_walking_direct = {
      type: TaskStates.WALKING_DIRECT,
      target_position: task_manager.player_state.parameters_walk_to_entity.target_position,
    }
    task_manager.player_state.parameters_walk_to_entity = undefined
    return
  }

  task_manager.player_state.parameters_walk_to_entity.path = event.path
  task_manager.player_state.parameters_walk_to_entity.path_drawn = false
  task_manager.player_state.parameters_walk_to_entity.path_index = 1
  task_manager.player_state.parameters_walk_to_entity.calculating_path = false
  log(`[AUTORIO] Path calculation completed. Path length: ${event.path}`)
})

script.on_event(defines.events.on_player_mined_entity, (unused_event: OnPlayerMinedEntityEvent) => {
  if (task_manager.player_state.task_state !== TaskStates.MINING) {
    return
  }

  if (!task_manager.player_state.parameters_mine_entity) {
    log('[AUTORIO] No parameters found when on_player_mined_entity event')
    return
  }

  if (task_manager.player_state.parameters_mine_entity.count <= 0) {
    log('[AUTORIO] Count is 0, switching to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  task_manager.player_state.parameters_mine_entity.count = task_manager.player_state.parameters_mine_entity.count - 1
})

function setup() {
  const surface = game.surfaces[1]
  const enemies = surface.find_entities_filtered({ force: 'enemy' })
  log(`[AUTORIO] Removing ${enemies.length} enemies`)
  for (const enemy of enemies) {
    enemy.destroy()
  }

  setup_complete = true
  log('[AUTORIO] Setup complete')
}

function draw_path(player: LuaPlayer, path: PathfinderWaypoint[]) {
  for (let i = 0; i < path.length - 1; i++) {
    rendering.draw_line({
      color: { r: 0, g: 1, b: 0 },
      width: 2,
      from: path[i].position,
      to: path[i + 1].position,
      surface: player.surface,
      time_to_live: 600,
      draw_on_ground: true,
    })
  }
}

function follow_path(player: LuaPlayer, path: PathfinderWaypoint[]) {
  if (path.length === 0) {
    return true
  }

  // check if reached next waypoint
  const next_position = path[0].position
  const d = distance(next_position, player.position)
  if (d < 0.1) {
    path.shift()
    return false
  }

  // move towards next waypoint
  const direction = get_direction(player.position, next_position)
  player.walking_state = {
    walking: true,
    direction,
  }

  return false
}

function state_walking_to_entity(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_walk_to_entity) {
    log('[AUTORIO] No parameters found when walking to entity')
    return
  }

  if (task_manager.player_state.parameters_walk_to_entity.calculating_path) {
    log('[AUTORIO] Path calculation in progress, skipping')
    return
  }

  // follow path
  if (task_manager.player_state.parameters_walk_to_entity.path) {
    if (!task_manager.player_state.parameters_walk_to_entity.path_drawn) {
      draw_path(player, task_manager.player_state.parameters_walk_to_entity.path)
      task_manager.player_state.parameters_walk_to_entity.path_drawn = true
      log('[AUTORIO] Path drawn on ground')
    }

    if (follow_path(player, task_manager.player_state.parameters_walk_to_entity.path)) {
      log('[AUTORIO] Task completed, switching to IDLE state')
      rendering.clear()
      task_manager.reset_task_state()
      task_manager.next_task()
    }

    return
  }

  // find nearest entity and calculate path
  const entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: task_manager.player_state.parameters_walk_to_entity.search_radius,
    name: task_manager.player_state.parameters_walk_to_entity.entity_name, // TODO: catch entity name not found error
  })

  if (!entities.length) {
    log('[AUTORIO] No entities found, reverting to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  if (entities.length === 0) {
    log(`[AUTORIO] [ERROR] No ${task_manager.player_state.parameters_walk_to_entity.entity_name} found in ${task_manager.player_state.parameters_walk_to_entity.search_radius}m radius, reverting to IDLE state`)
    task_manager.cancel_all_tasks()
    return
  }

  const nearest_entity = get_nearest_entity(player, entities)

  log(`[AUTORIO] Nearest entity position: ${serpent.line(nearest_entity?.position)}`)
  log(`[AUTORIO] Player position: ${serpent.line(player.position)}`)
  log(`[AUTORIO] Player bounding box: ${serpent.line(player.character?.bounding_box)}`)

  if (nearest_entity && !task_manager.player_state.parameters_walk_to_entity.calculating_path && !task_manager.player_state.parameters_walk_to_entity.path) {
    const character = player.character
    if (!character) {
      log('[AUTORIO] Player character not found, aborting pathfinding')
      return
    }

    // TODO: improve path following, check if stuck on objects
    // currently using larger than character bbox as a workaround for the path following getting stuck on objects
    // may sometimes still get stuck on trees and will fail to find small passages
    const bbox: BoundingBoxArray = [[-0.5, -0.5], [0.5, 0.5]]
    const start = player.surface.find_non_colliding_position(
      'iron-chest', // TODO: using iron chest bbox so request_path doesn't fail standing near objects using the larger bbox
      character.position,
      10,
      0.5,
      false,
    )

    if (!start) {
      log('[AUTORIO] find_non_colliding_position returned nil! Aborting pathfinding.')
      return
    }

    const collision_mask: CollisionMask = {
      layers: {
        player: true,
        train: true,
        water_tile: true,
        object: true,
        // car: true,
        // cliff: true,
      },
      consider_tile_transitions: true,
    }

    player.surface.request_path({
      bounding_box: bbox,
      collision_mask,
      radius: 2,
      start,
      goal: nearest_entity.position,
      force: player.force,
      entity_to_ignore: character,
      pathfind_flags: {
        cache: false,
        no_break: true,
        prefer_straight_paths: false,
        allow_paths_through_own_entities: false,
      },
    })
    task_manager.player_state.parameters_walk_to_entity.calculating_path = true
    task_manager.player_state.parameters_walk_to_entity.target_position = nearest_entity.position
    log(`[AUTORIO] Requested path calculation to ${serpent.line(nearest_entity.position)}`)
  }
}

function state_mining(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_mine_entity) {
    log('[AUTORIO] No parameters found when mining')
    return
  }

  if (player.mining_state.mining) {
    return
  }

  if (task_manager.player_state.parameters_mine_entity.position) {
    start_mining(player, task_manager.player_state.parameters_mine_entity.position)
    return
  }

  const entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: 5, // but player can only mine entities within 2 tiles
    name: task_manager.player_state.parameters_mine_entity.entity_name,
  })

  if (entities.length === 0) {
    log('[AUTORIO] No entity found to mine, switching to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  const nearest_entity = get_nearest_entity(player, entities)
  if (!nearest_entity) {
    log('[AUTORIO] No entity found to mine, switching to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  start_mining(player, nearest_entity.position)
}

function state_placing(player: LuaPlayer) {
  if (!player) {
    log('[AUTORIO] Invalid player, ending PLACING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return [false, 'Invalid player']
  }

  if (!task_manager.player_state.parameters_place_entity) {
    log('[AUTORIO] No parameters found when placing')
    return
  }

  const surface = player.surface
  const inventory = player.get_main_inventory()

  if (!inventory) {
    log('[AUTORIO] Cannot access player inventory, ending PLACING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return [false, 'Cannot access player inventory']
  }

  const entity_prototype = prototypes.entity[task_manager.player_state.parameters_place_entity.entity_name]
  if (!entity_prototype || !entity_prototype.items_to_place_this) {
    log('[AUTORIO] Invalid entity name, ending PLACING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return [false, 'Invalid entity name']
  }

  const item_name = entity_prototype.items_to_place_this[0]
  if (!item_name) {
    log('[AUTORIO] Invalid entity name, ending PLACING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return [false, 'Invalid entity name']
  }

  const [item_stack, unused_count] = inventory.find_item_stack(task_manager.player_state.parameters_place_entity.entity_name)
  if (!item_stack) {
    log('[AUTORIO] Entity not found in inventory, ending PLACING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return [false, 'Entity not found in inventory']
  }

  if (!task_manager.player_state.parameters_place_entity.position) {
    task_manager.player_state.parameters_place_entity.position = surface.find_non_colliding_position(task_manager.player_state.parameters_place_entity.entity_name, player.position, 1, 1)
    if (!task_manager.player_state.parameters_place_entity.position) {
      log('[AUTORIO] Could not find a valid position to place the entity, ending PLACING task')
      task_manager.reset_task_state()
      task_manager.next_task()
      return [false, 'Could not find a valid position to place the entity']
    }
  }

  task_manager.player_state.task_state = TaskStates.IDLE
  const create_entity_args: SurfaceCreateEntity = {
    name: task_manager.player_state.parameters_place_entity.entity_name,
    position: task_manager.player_state.parameters_place_entity.position,
    force: player.force,
    raise_built: true,
    player,
  }
  const entity = surface.create_entity(create_entity_args)

  if (entity) {
    item_stack.count = item_stack.count - 1
    log(`[AUTORIO] Entity placed successfully: ${task_manager.player_state.parameters_place_entity.entity_name}`)
    task_manager.reset_task_state()
    task_manager.next_task()
    return [true, 'Entity placed successfully', entity]
  }
  log(`[AUTORIO] Failed to place entity: ${task_manager.player_state.parameters_place_entity.entity_name}`)
  return [false, 'Failed to place entity']
}

// TODO: Move items between specified entity and player inventory, give the entity name and position as parameters
function state_moving_items(player: LuaPlayer) {
  const parameters = task_manager.player_state.parameters_move_items

  if (!parameters) {
    log('[AUTORIO] No parameters found when moving items')
    return
  }

  const nearby_entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: 8,
    name: parameters.entity_name,
    force: player.force,
  })

  const player_inventory = player.get_main_inventory()
  if (!player_inventory) {
    log('[AUTORIO] Cannot access player inventory, ending MOVING_ITEMS task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  let moved_total = 0

  if (parameters.to_entity) {
    const [item_stack, unused_count] = player_inventory.find_item_stack(parameters.item_name)
    if (!item_stack) {
      log('[AUTORIO] Item not found in player inventory, ending MOVING_ITEMS task')
      task_manager.reset_task_state()
      task_manager.next_task()
      return
    }

    nearby_entities
      .filter(it => it.can_insert({ name: parameters.item_name }))
      .map((entity) => {
        const max_index = entity.get_max_inventory_index()
        const inventories: LuaInventory[] = []
        for (let i = 1; i <= max_index; i++) {
          const inventory = entity.get_inventory(i)
          if (inventory && inventory.can_insert({ name: parameters.item_name })) {
            inventories.push(inventory)
          }
        }

        return inventories
      })
      .flat()
      .forEach((inventory) => {
        if (moved_total >= parameters.max_count) {
          return
        }

        const to_move = math.min(item_stack.count, parameters.max_count - moved_total)
        if (to_move <= 0) {
          return
        }

        log(`[AUTORIO] Moving ${to_move} ${parameters.item_name} to ${inventory.entity_owner?.name} inventory index ${inventory.index}`)
        const moved = inventory.insert({ name: parameters.item_name, count: to_move })
        if (moved > 0) {
          player_inventory.remove({ name: parameters.item_name, count: moved })
          moved_total += moved

          log(`[AUTORIO] Moved ${moved} ${parameters.item_name} to ${inventory.entity_owner?.name} inventory index ${inventory.index}`)
        }
      })
  }
  else {
    nearby_entities
      .map((entity) => {
        const max_index = entity.get_max_inventory_index()
        const inventories: LuaInventory[] = []
        for (let i = 1; i <= max_index; i++) {
          const inventory = entity.get_inventory(i)
          if (!inventory) {
            continue
          }
          inventories.push(inventory)
        }

        return inventories
      })
      .flat()
      .forEach((inventory) => {
        if (moved_total >= parameters.max_count) {
          return
        }

        if (!player_inventory.can_insert({ name: parameters.item_name })) {
          log(`[AUTORIO] Cannot insert ${parameters.item_name} into player inventory, skipping`)
          return
        }

        const removed = inventory.remove({ name: parameters.item_name, count: parameters.max_count - moved_total })
        if (removed <= 0) {
          return
        }

        const inserted = player_inventory.insert({ name: parameters.item_name, count: removed })
        if (inserted < removed) {
          // move back the remaining items
          inventory.insert({ name: parameters.item_name, count: removed - inserted })
          moved_total += inserted
        }
        else {
          moved_total += removed
        }

        moved_total += removed
        log(`[AUTORIO] Moved ${removed} ${parameters.item_name} from ${inventory.entity_owner?.name} inventory index ${inventory.index}`)
      })
  }

  if (moved_total === 0) {
    log('[AUTORIO] No items moved, ending task')
  }
  else {
    log(`[AUTORIO] Moved a total of ${moved_total} ${parameters.item_name}`)
  }

  task_manager.reset_task_state()
  task_manager.next_task()
}

function check_can_craft(player: LuaPlayer, item_name: string, count: number) {
  const recipe = player.force.recipes[item_name]

  if (!recipe) {
    log(`[AUTORIO] No such recipe: ${item_name}`)
    return false
  }

  const ingredients = recipe.ingredients
  const player_inventory = player.get_main_inventory()

  if (!player_inventory) {
    log('[AUTORIO] Cannot access player inventory, ending CRAFTING task')
    return false
  }

  const not_enough_ingredients: { name: string, amount: number }[] = []

  // TODO check dependencies
  for (const ingredient of ingredients) {
    const item_count = player_inventory.get_item_count(ingredient.name)

    if (item_count < ingredient.amount * count) {
      not_enough_ingredients.push({ name: ingredient.name, amount: ingredient.amount * count - item_count })
    }
  }

  if (not_enough_ingredients.length > 0) {
    log(`[AUTORIO] [ERROR] No enough ingredients to craft ${item_name}: ${serpent.line(not_enough_ingredients)}`)
    return false
  }

  return true
}

function state_researching(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_research_technology) {
    log('[AUTORIO] No parameters found when researching')
    return
  }

  const force = player.force
  const tech = force.technologies[task_manager.player_state.parameters_research_technology.technology_name]

  if (tech.researched) {
    log(`[AUTORIO] Research completed: ${task_manager.player_state.parameters_research_technology.technology_name}`)
    task_manager.reset_task_state()
    task_manager.next_task()
  }
  else if (force.current_research !== tech) {
    log(`[AUTORIO] Research interrupted: ${task_manager.player_state.parameters_research_technology.technology_name}`)
    task_manager.reset_task_state()
    task_manager.next_task()
  }
}

function state_walking_direct(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_walking_direct) {
    log('[AUTORIO] No parameters found when walking directly')
    return
  }

  const target = task_manager.player_state.parameters_walking_direct.target_position

  if (target) {
    const direction = get_direction(player.position, target)
    player.walking_state = {
      walking: true,
      direction,
    }

    if (((target.x - player.position.x) ** 2 + (target.y - player.position.y) ** 2) < 2) {
      log('[AUTORIO] Reached target, switching to IDLE state')
      task_manager.reset_task_state()
      task_manager.next_task()
    }
  }
  else {
    log('[AUTORIO] No target position, switching to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
  }
}

function state_waiting() {
  if (!task_manager.player_state.parameters_waiting) {
    log('[AUTORIO] No parameters found when waiting')
    return
  }

  if (task_manager.player_state.parameters_waiting.remaining_ticks <= 0) {
    log('[AUTORIO] Waiting task complete')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  task_manager.player_state.parameters_waiting.remaining_ticks -= 1
}

let no_player_found = false

script.on_event(defines.events.on_tick, (unused_event) => {
  if (!setup_complete) {
    setup()
  }

  const player = game.connected_players[0]
  if (player === undefined || player.character === undefined) {
    if (!no_player_found) {
      log('[AUTORIO] No valid player found')
      no_player_found = true
    }
    return
  }

  if (task_manager.player_state.task_state === TaskStates.IDLE) {
    return
  }

  if (task_manager.player_state.task_state === TaskStates.WALKING_TO_ENTITY) {
    state_walking_to_entity(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.MINING) {
    state_mining(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.PLACING) {
    state_placing(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.MOVING_ITEMS) {
    state_moving_items(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.RESEARCHING) {
    state_researching(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.WALKING_DIRECT) {
    state_walking_direct(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.WAITING) {
    state_waiting()
  }
})

script.on_event(defines.events.on_player_crafted_item, (event: OnPlayerCraftedItemEvent) => {
  // compact for lua array index
  log(`[AUTORIO] Player ${game.connected_players[event.player_index - 1].name} crafted item: ${event.item_stack.name}`) // TODO: determine player index

  if (!task_manager.player_state.parameters_craft_item) {
    log('[AUTORIO] No parameters found when item crafted')
    return
  }

  if (task_manager.player_state.task_state !== TaskStates.CRAFTING) {
    return
  }

  task_manager.player_state.parameters_craft_item.crafted = task_manager.player_state.parameters_craft_item.crafted + 1
  log(`[AUTORIO] Crafted 1 ${task_manager.player_state.parameters_craft_item.item_name}, remaining: ${task_manager.player_state.parameters_craft_item.count - task_manager.player_state.parameters_craft_item.crafted}`)

  if (task_manager.player_state.parameters_craft_item.crafted >= task_manager.player_state.parameters_craft_item.count) {
    log('[AUTORIO] Crafting task complete')
    task_manager.reset_task_state()
    task_manager.next_task()
  }
})

log('[AUTORIO] Mod loaded 1')
