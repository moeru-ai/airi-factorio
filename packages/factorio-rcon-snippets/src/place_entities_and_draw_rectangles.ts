import type { MapPosition } from 'factorio:prototype'
import type { LuaEntity } from 'factorio:runtime'

export function rconScriptPlaceAssemblerAndTakeScreenshot() {
  const surface_name = 'nauvis'
  const surface = game.surfaces[surface_name]

  function draw_text(text: string, position: MapPosition) {
    rendering.draw_text({
      target: position,
      text,
      scale: 0.8,
      surface: surface_name,
      color: { g: 1 },
    })
  }

  function draw_rectangle(left_top: MapPosition, right_bottom: MapPosition) {
    rendering.draw_rectangle({
      left_top,
      right_bottom,
      color: { g: 1 },
      surface: surface_name,
      width: 2,
    })
  }

  function draw_entity_rectangle(entity: LuaEntity) {
    draw_rectangle(
      entity.selection_box.left_top,
      entity.selection_box.right_bottom,
    )
  }

  function draw_entity_name(entity: LuaEntity) {
    draw_text(entity.name, {
      x: entity.selection_box.left_top.x,
      y: entity.selection_box.left_top.y - 0.5,
    })
  }

  function draw_entity_info(entity: LuaEntity) {
    draw_entity_name(entity)
    draw_entity_rectangle(entity)
  }

  function create_entity_and_draw_info(
    name: string,
    position: MapPosition,
    direction: defines.direction = defines.direction.east,
  ) {
    const entity = surface.create_entity({
      name,
      position,
      direction,
    })

    if (!entity) {
      rcon.print('done')
      return
    }

    draw_entity_info(entity)
  }

  rendering.clear()

  surface.daytime = 1

  const player_position = game.players[1].position
  const capture_center: MapPosition = {
    x: math.floor(player_position.x),
    y: math.floor(player_position.y),
  }

  const entities = surface.find_entities()

  for (const it of entities) {
    if (it.is_player())
      continue
    it.destroy()
  }

  create_entity_and_draw_info('assembling-machine-3', capture_center)
  create_entity_and_draw_info('fast-inserter', {
    x: capture_center.x + 2,
    y: capture_center.y,
  })
  create_entity_and_draw_info('express-transport-belt', {
    x: capture_center.x + 3,
    y: capture_center.y,
  }, defines.direction.north)
  create_entity_and_draw_info('express-transport-belt', {
    x: capture_center.x + 3,
    y: capture_center.y - 1,
  }, defines.direction.north)
  create_entity_and_draw_info('express-transport-belt', {
    x: capture_center.x + 3,
    y: capture_center.y + 1,
  }, defines.direction.north)

  game.take_screenshot({
    position: { x: capture_center.x + 2.5, y: capture_center.y },
    resolution: { x: 540, y: 540 },
    zoom: 2,
  })

  rcon.print('done')
}
