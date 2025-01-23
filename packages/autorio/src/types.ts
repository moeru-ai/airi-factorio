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
  AUTO_INSERTING = 'auto_inserting',
  ATTACKING = 'attacking',
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
  position?: MapPositionStruct
}

export interface PlayerParametersPlaceEntity {
  type: TaskStates.PLACING
  entity_name: string
  position?: MapPositionStruct
}

export interface PlayerParametersAutoInsertNearby {
  type: TaskStates.AUTO_INSERTING
  item_name: string
  entity_name: string
  max_count: number
}

export interface PlayerParametersPickupItem {
  type: TaskStates.PICKING_UP
  item_name: string
  count: number
  container_name: string
  search_radius: number
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

export type PlayerParameters =
  | PlayerParametersWalkToEntity
  | PlayerParametersWalkingDirect
  | PlayerParametersMineEntity
  | PlayerParametersPlaceEntity
  | PlayerParametersAutoInsertNearby
  | PlayerParametersPickupItem
  | PlayerParametersCraftItem
  | PlayerParametersAttackNearestEnemy
  | PlayerParametersResearchTechnology

export interface PlayerState {
  task_state: TaskStates
  parameters_walk_to_entity?: PlayerParametersWalkToEntity
  parameters_walking_direct?: PlayerParametersWalkingDirect
  parameters_mine_entity?: PlayerParametersMineEntity
  parameters_place_entity?: PlayerParametersPlaceEntity
  parameters_auto_insert_nearby?: PlayerParametersAutoInsertNearby
  parameters_pickup_item?: PlayerParametersPickupItem
  parameters_craft_item?: PlayerParametersCraftItem
  parameters_attack_nearest_enemy?: PlayerParametersAttackNearestEnemy
  parameters_research_technology?: PlayerParametersResearchTechnology
}
