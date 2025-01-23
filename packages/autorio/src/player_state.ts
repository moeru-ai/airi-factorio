import type { PlayerParameters, PlayerState } from './types'
import { TaskStates } from './types'

export function new_task_manager() {
  const player_state: PlayerState = {
    task_state: TaskStates.IDLE,
  }

  const task_queue: PlayerParameters[] = []

  function add_task(task: PlayerParameters) {
    task_queue.push(task)
    log(`[AUTORIO] Task added: ${task.type}, task queue length: ${task_queue.length}`)

    if (task_queue.length === 1) {
      next_task()
    }
  }

  function reset_task_state() {
    player_state.task_state = TaskStates.IDLE
    player_state.parameters_walk_to_entity = undefined
    player_state.parameters_walking_direct = undefined
    player_state.parameters_mine_entity = undefined
    player_state.parameters_place_entity = undefined
    player_state.parameters_auto_insert_nearby = undefined
    player_state.parameters_pickup_item = undefined
    player_state.parameters_craft_item = undefined
    player_state.parameters_attack_nearest_enemy = undefined
    player_state.parameters_research_technology = undefined
  }

  function next_task() {
    if (player_state.task_state !== TaskStates.IDLE) {
      log('[AUTORIO] Task state is not IDLE, wont execute next task')
      return
    }

    const task = task_queue.shift()
    if (!task) {
      player_state.task_state = TaskStates.IDLE
      return
    }

    log(`[AUTORIO] Next task: ${task.type}, task queue length: ${task_queue.length}`)
    player_state.task_state = task.type
    switch (task.type) {
      case TaskStates.WALKING_TO_ENTITY:
        player_state.parameters_walk_to_entity = task
        break
      case TaskStates.WALKING_DIRECT:
        player_state.parameters_walking_direct = task
        break
      case TaskStates.MINING:
        player_state.parameters_mine_entity = task
        break
      case TaskStates.PLACING:
        player_state.parameters_place_entity = task
        break
      case TaskStates.AUTO_INSERTING:
        player_state.parameters_auto_insert_nearby = task
        break
      case TaskStates.PICKING_UP:
        player_state.parameters_pickup_item = task
        break
      case TaskStates.CRAFTING:
        player_state.parameters_craft_item = task
        break
      case TaskStates.ATTACKING:
        player_state.parameters_attack_nearest_enemy = task
        break
      case TaskStates.RESEARCHING:
        player_state.parameters_research_technology = task
        break
    }
  }

  function is_task_queue_empty() {
    return task_queue.length === 0
  }

  return {
    player_state,
    add_task,
    next_task,
    is_task_queue_empty,
    reset_task_state,
  }
}
