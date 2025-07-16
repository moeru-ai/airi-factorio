import type { MapPositionStruct } from 'factorio:prototype'
import type { LuaEntity, PathfinderWaypoint } from 'factorio:runtime'

export enum TaskStates {
  IDLE = 'idle',
  WALKING_TO_ENTITY = 'walking_to_entity',
  MINING = 'mining',
  PLACING = 'placing',
  PLACING_IN_CHEST = 'placing_in_chest',
  PICKING_UP = 'picking_up',
  CRAFTING = 'crafting',
  RESEARCHING = 'researching',
  WALKING_DIRECT = 'walking_direct',
  MOVING_ITEMS = 'moving_items',
  ATTACKING = 'attacking',
  WAITING = 'waiting',
}

export interface PlayerParametersWalkToEntity {
  type: TaskStates.WALKING_TO_ENTITY
  entity_name: string
  search_radius: number
  path: PathfinderWaypoint[] | null
  path_drawn: boolean
  path_index: number
  calculating_path: boolean
  target_position: MapPositionStruct | null
}

export interface PlayerParametersWalkingDirect {
  type: TaskStates.WALKING_DIRECT
  target_position: MapPositionStruct | null
}

export interface PlayerParametersMineEntity {
  type: TaskStates.MINING
  entity_name: string
  count: number
  position?: MapPositionStruct
}

export interface PlayerParametersPlaceEntity {
  type: TaskStates.PLACING
  entity_name: string
  position?: MapPositionStruct
}

export interface PlayerParametersMoveItems {
  type: TaskStates.MOVING_ITEMS
  item_name: string
  entity_name: string
  max_count: number
  to_entity: boolean // If true, the items will be moved to the entity, otherwise, the items will be moved to the player's inventory
}

export interface PlayerParametersCraftItem {
  type: TaskStates.CRAFTING
  item_name: string
  count: number
  crafted: number
}

export interface PlayerParametersAttackNearestEnemy {
  type: TaskStates.ATTACKING
  search_radius: number
  target: LuaEntity | null
}

export interface PlayerParametersResearchTechnology {
  type: TaskStates.RESEARCHING
  technology_name: string
}

export interface PlayerParametersWaiting {
  type: TaskStates.WAITING
  remaining_ticks: number
}

export type PlayerParameters
  = | PlayerParametersWalkToEntity
    | PlayerParametersWalkingDirect
    | PlayerParametersMineEntity
    | PlayerParametersPlaceEntity
    | PlayerParametersMoveItems
    | PlayerParametersCraftItem
    | PlayerParametersAttackNearestEnemy
    | PlayerParametersResearchTechnology
    | PlayerParametersWaiting

export interface PlayerState {
  task_state: TaskStates
  parameters_walk_to_entity?: PlayerParametersWalkToEntity
  parameters_walking_direct?: PlayerParametersWalkingDirect
  parameters_mine_entity?: PlayerParametersMineEntity
  parameters_place_entity?: PlayerParametersPlaceEntity
  parameters_move_items?: PlayerParametersMoveItems
  parameters_craft_item?: PlayerParametersCraftItem
  parameters_attack_nearest_enemy?: PlayerParametersAttackNearestEnemy
  parameters_research_technology?: PlayerParametersResearchTechnology
  parameters_waiting?: PlayerParametersWaiting
}
