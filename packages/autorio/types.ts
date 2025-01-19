import type { MapPositionStruct } from 'factorio:prototype'
import type { LuaEntity, PathfinderWaypoint } from 'factorio:runtime'

export enum TaskStates {
  IDLE,
  WALKING_TO_ENTITY,
  MINING,
  PLACING,
  PLACING_IN_CHEST,
  PICKING_UP,
  CRAFTING,
  RESEARCHING,
  WALKING_DIRECT,
  AUTO_INSERTING,
  ATTACKING,
}

export interface PlayerParametersWalkToEntity {
  entity_name: string
  search_radius: number
  path: PathfinderWaypoint[] | null
  path_drawn: boolean
  path_index: number
  calculating_path: boolean
  should_mine: boolean
  target_position: MapPositionStruct | null
}

export interface PlayerParametersWalkingDirect {
  target_position: MapPositionStruct | null
}

export interface PlayerParametersMineEntity {
  entity_name: string
}

export interface PlayerParametersPlaceEntity {
  entity_name: string
  position?: MapPositionStruct
}

export interface PlayerParametersAutoInsertNearby {
  item_name: string
  entity_name: string
  max_count: number
}

export interface PlayerParametersPickupItem {
  item_name: string
  count: number
  container_name: string
  search_radius: number
}

export interface PlayerParametersCraftItem {
  item_name: string
  count: number
  crafted: number
}

export interface PlayerParametersAttackNearestEnemy {
  search_radius: number
  target: LuaEntity | null
}

export interface PlayerParametersResearchTechnology {
  technology_name: string
}

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
