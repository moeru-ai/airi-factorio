import type { MapPosition, MapPositionStruct } from 'factorio:prototype'
import type {
  BoundingBoxArray,
  CollisionMask,
  EquipmentPosition,
  LuaEntity,
  LuaPlayer,
  OnPlayerCraftedItemEvent,
  OnPlayerMinedEntityEvent,
  OnScriptPathRequestFinishedEvent,
  OnSelectedEntityChangedEvent,
  SurfaceCreateEntity,
} from 'factorio:runtime'

import { new_task_manager } from './player_state'
import { TaskStates } from './types'
import { distance } from './utils/math'

let setup_complete = false

const task_manager = new_task_manager()

function log_player_info(player_id: number) {
  // compact for lua array index
  const player = game.connected_players[player_id - 1]
  const log_data: {
    name: string
    position: MapPosition
    force: string
    inventory: { name: string, count: number }[]
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

  const main_inventory = player.get_main_inventory()
  if (main_inventory) {
    main_inventory.get_contents().forEach(({ name, count }) => {
      log_data.inventory.push({ name, count })
    })
  }

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

remote.add_interface('autorio_tasks', {
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

  mine_entity: (entity_name: string) => {
    task_manager.add_task({
      type: TaskStates.MINING,
      entity_name,
    })

    log(`[AUTORIO] New mine_entity task: ${entity_name}`)
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
  auto_insert_nearby: (item_name: string, entity_name: string, max_count: number): [boolean, string] => {
    task_manager.add_task({
      type: TaskStates.AUTO_INSERTING,
      item_name,
      entity_name,
      max_count: max_count || math.huge,
    })

    log(`[AUTORIO] New auto_insert_nearby task for ${item_name} into ${entity_name}`)
    return [true, 'Task started']
  },
  pick_up_item: (item_name: string, container_name: string, count: number): [boolean, string] => {
    task_manager.add_task({
      type: TaskStates.PICKING_UP,
      item_name,
      count: count || 1,
      container_name,
      search_radius: 8,
    })

    log(`[AUTORIO] New pick_up_item task: ${item_name} x${count} from ${container_name}`)
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
  log(`[AUTORIO] current mining state: ${serpent.line(player.mining_state)}`)

  player.update_selected_entity(entity_position)
  player.mining_state = { mining: true, position: entity_position } // should not use player.mine_entity() because it will skip the mining animation
  log(`[AUTORIO] Started mining at position: ${serpent.line(entity_position)}`)
}

script.on_event(defines.events.on_selected_entity_changed, (event: OnSelectedEntityChangedEvent) => {
  if (task_manager.player_state.task_state === TaskStates.MINING) {
    // FIXME: who are changing the selected entity while mining?
    // This only happens in multiplayer, why?

    const player = game.connected_players[event.player_index - 1]
    if (!player) {
      return
    }

    log(`[AUTORIO] Selected entity changed while mining, now selected: ${player.selected?.name}`)
  }
})

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
  log('[AUTORIO] Entity mined, next task')
  task_manager.reset_task_state()
  task_manager.next_task()
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

function state_walking_to_entity(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_walk_to_entity) {
    log('[AUTORIO] No parameters found when walking to entity')
    return
  }

  const entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: task_manager.player_state.parameters_walk_to_entity.search_radius,
    name: task_manager.player_state.parameters_walk_to_entity.entity_name, // TODO: catch entity name not found error
  })
  if (entities.length === 0) {
    log('[AUTORIO] No entities found, reverting to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
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

    // TODO: improve path following
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

  if (task_manager.player_state.parameters_walk_to_entity.path && nearest_entity) {
    if (!task_manager.player_state.parameters_walk_to_entity.path_drawn) {
      for (let i = 0; i < task_manager.player_state.parameters_walk_to_entity.path.length - 1; i++) {
        rendering.draw_line({
          color: { r: 0, g: 1, b: 0 },
          width: 2,
          from: task_manager.player_state.parameters_walk_to_entity.path[i].position,
          to: task_manager.player_state.parameters_walk_to_entity.path[i + 1].position,
          surface: player.surface,
          time_to_live: 600,
          draw_on_ground: true,
        })
      }
      task_manager.player_state.parameters_walk_to_entity.path_drawn = true
      log('[AUTORIO] Path drawn on ground')
    }

    const path = task_manager.player_state.parameters_walk_to_entity.path
    const path_index = task_manager.player_state.parameters_walk_to_entity.path_index

    if (path_index < path.length && distance(nearest_entity.position, player.position) > 1) {
      const next_position = path[path_index].position
      const direction = get_direction(player.position, next_position)

      player.walking_state = {
        walking: true,
        direction,
      }

      if (((next_position.x - player.position.x) ** 2 + (next_position.y - player.position.y) ** 2) < 0.01) {
        task_manager.player_state.parameters_walk_to_entity.path_index = path_index + 1
        log(`[AUTORIO] Moving to next path index: ${task_manager.player_state.parameters_walk_to_entity.path_index}`)
      }
      // no need to square root
      if (((nearest_entity.position.x - player.position.x) ** 2 + (nearest_entity.position.y - player.position.y) ** 2) < 0.01) {
        log('[AUTORIO] Reached target entity, switching to IDLE state')

        // fix final position, avoid walked to the target but cannot interact with it
        player.teleport(nearest_entity.position)

        task_manager.reset_task_state()
        task_manager.next_task()
      }
    }
    else {
      rendering.clear()
      player.walking_state = { walking: false, direction: player.walking_state.direction }

      log('[AUTORIO] Task completed, switching to IDLE state')
      task_manager.reset_task_state()
      task_manager.next_task()
    }
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

  const nearest_entity = player.surface.find_entities_filtered({
    position: player.position,
    radius: 2, // player can only mine entities within 2 tiles
    name: task_manager.player_state.parameters_mine_entity.entity_name,
    limit: 1,
  })[0]

  if (nearest_entity !== undefined) {
    start_mining(player, nearest_entity.position)
  }
  else {
    log('[AUTORIO] No entity found to mine, switching to IDLE state')
    task_manager.reset_task_state()
    task_manager.next_task()
  }
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
    return [true, 'Entity placed successfully', entity]
  }
  log(`[AUTORIO] Failed to place entity: ${task_manager.player_state.parameters_place_entity.entity_name}`)
  return [false, 'Failed to place entity']
}

function state_picking_up(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_pickup_item) {
    log('[AUTORIO] No parameters found when picking up')
    return
  }

  const nearby_containers = player.surface.find_entities_filtered({
    position: player.position,
    radius: task_manager.player_state.parameters_pickup_item.search_radius,
    name: task_manager.player_state.parameters_pickup_item.container_name,
    force: player.force,
  })

  const player_inventory = player.get_main_inventory()
  if (!player_inventory) {
    log('[AUTORIO] Cannot access player inventory, ending PICKING_UP task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  let picked_up_total = 0

  for (const container of nearby_containers) {
    const max_index = container.get_max_inventory_index()
    for (let i = 1; i <= max_index; i++) {
      const inventory = container.get_inventory(i)
      if (inventory) { // Check if inventory exists at this index
        const [item_stack, unused_count] = inventory.find_item_stack(task_manager.player_state.parameters_pickup_item.item_name)
        if (item_stack) {
          const to_pick_up = math.min(item_stack.count, task_manager.player_state.parameters_pickup_item.count - picked_up_total)
          const picked_up = player_inventory.insert({ name: task_manager.player_state.parameters_pickup_item.item_name, count: to_pick_up })

          if (picked_up > 0) {
            inventory.remove({ name: task_manager.player_state.parameters_pickup_item.item_name, count: picked_up })
            picked_up_total = picked_up_total + picked_up
            log(`[AUTORIO] Picked up ${picked_up} ${task_manager.player_state.parameters_pickup_item.item_name} from ${container.name} inventory index ${i}`)
          }

          if (picked_up_total >= task_manager.player_state.parameters_pickup_item.count) {
            break
          }
        }
      }
      if (picked_up_total >= task_manager.player_state.parameters_pickup_item.count) {
        break
      }
    }
    if (picked_up_total >= task_manager.player_state.parameters_pickup_item.count) {
      break
    }
  }

  if (picked_up_total === 0) {
    log('[AUTORIO] No items picked up, ending task')
  }
  else {
    log(`[AUTORIO] Picked up a total of ${picked_up_total} ${task_manager.player_state.parameters_pickup_item.item_name}`)
  }

  task_manager.reset_task_state()
  task_manager.next_task()
}

function state_auto_inserting(player: LuaPlayer) {
  if (!task_manager.player_state.parameters_auto_insert_nearby) {
    log('[AUTORIO] No parameters found when auto inserting')
    return
  }

  const nearby_entities = player.surface.find_entities_filtered({
    position: player.position,
    radius: 8,
    name: task_manager.player_state.parameters_auto_insert_nearby.entity_name,
    force: player.force,
  })

  const player_inventory = player.get_main_inventory()
  if (!player_inventory) {
    log('[AUTORIO] Cannot access player inventory, ending AUTO_INSERTING task')
    task_manager.reset_task_state()
    task_manager.next_task()
    return
  }

  const [item_stack, unused_count] = player_inventory.find_item_stack(task_manager.player_state.parameters_auto_insert_nearby.item_name)
  let inserted_total = 0

  if (item_stack) {
    for (const entity of nearby_entities) {
      const max_index = entity.get_max_inventory_index()
      if (entity.can_insert({ name: task_manager.player_state.parameters_auto_insert_nearby.item_name })) {
        for (let i = 1; i <= max_index; i++) {
          const inventory = entity.get_inventory(i)
          if (inventory && inventory.can_insert({ name: task_manager.player_state.parameters_auto_insert_nearby.item_name })) {
            const to_insert = math.min(item_stack.count, task_manager.player_state.parameters_auto_insert_nearby.max_count - inserted_total)
            const inserted = inventory.insert({ name: task_manager.player_state.parameters_auto_insert_nearby.item_name, count: to_insert })
            if (inserted > 0) {
              player_inventory.remove({ name: task_manager.player_state.parameters_auto_insert_nearby.item_name, count: inserted })
              inserted_total = inserted_total + inserted
              log(`[AUTORIO] Inserted ${inserted} ${task_manager.player_state.parameters_auto_insert_nearby.item_name} into ${entity.name} inventory index ${i}`)
            }
            if (inserted_total >= task_manager.player_state.parameters_auto_insert_nearby.max_count) {
              break
            }
          }
          if (inserted_total >= task_manager.player_state.parameters_auto_insert_nearby.max_count) {
            break
          }
        }
        if (inserted_total >= task_manager.player_state.parameters_auto_insert_nearby.max_count) {
          break
        }
      }
    }

    if (inserted_total === 0) {
      log('[AUTORIO] No items inserted, ending task')
    }
    else {
      log(`[AUTORIO] Inserted a total of ${inserted_total} ${task_manager.player_state.parameters_auto_insert_nearby.item_name}`)
    }

    task_manager.reset_task_state()
    task_manager.next_task()
  }
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
    log(`[AUTORIO] No enough ingredients to craft ${item_name}: ${serpent.line(not_enough_ingredients)}`)
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
  else if (task_manager.player_state.task_state === TaskStates.AUTO_INSERTING) {
    state_auto_inserting(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.PICKING_UP) {
    state_picking_up(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.RESEARCHING) {
    state_researching(player)
  }
  else if (task_manager.player_state.task_state === TaskStates.WALKING_DIRECT) {
    state_walking_direct(player)
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
