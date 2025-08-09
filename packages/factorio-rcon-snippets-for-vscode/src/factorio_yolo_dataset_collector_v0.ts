/**
 * If we create and destroy entities in the same tick,
 * the screenshots will be the last state, so we need to run this script multiple times.
 */
import type { MapPositionStruct } from 'factorio:prototype'
import type { BoundingBox } from 'factorio:runtime'

rendering.clear()

const surface_name = 'nauvis'
const surface = game.surfaces[surface_name]
const player = game.players[1]
const player_position = player.position
const capture_center: MapPositionStruct = {
  x: math.floor(player_position.x),
  y: math.floor(player_position.y),
}
const resolution = { x: 1280, y: 1280 }

function clear_entities() {
  const entities = surface.find_entities()
  for (const e of entities) {
    e.destroy()
  }
}

// when zoom_level is 2 and resolution is 1280x1280, a picture contains 20x20 tiles
// when zoom_level is 4 and resolution is 1280x1280, a picture contains 10x10 tiles
// so we need to calculate the capture_box based on the zoom_level
function calc_capture_box(
  zoom_level: number,
): BoundingBox {
  const tile_size = 32 * zoom_level
  const tile_count_x = resolution.x / tile_size
  const offset_x = tile_count_x / 2
  const tile_count_y = resolution.y / tile_size
  const offset_y = tile_count_y / 2

  return {
    left_top: { x: capture_center.x - offset_x, y: capture_center.y - offset_y },
    right_bottom: { x: capture_center.x + offset_x, y: capture_center.y + offset_y },
  }
}

function selection_box_to_yolo_label(capture_box: BoundingBox, selection_box: BoundingBox) {
  const capture_box_width = capture_box.right_bottom.x - capture_box.left_top.x
  const capture_box_height = capture_box.right_bottom.y - capture_box.left_top.y

  const center_x = ((selection_box.left_top.x + selection_box.right_bottom.x) / 2 - capture_box.left_top.x) / capture_box_width
  const center_y = ((selection_box.left_top.y + selection_box.right_bottom.y) / 2 - capture_box.left_top.y) / capture_box_height
  const width = (selection_box.right_bottom.x - selection_box.left_top.x) / capture_box_width
  const height = (selection_box.right_bottom.y - selection_box.left_top.y) / capture_box_height

  return `${center_x} ${center_y} ${width} ${height}`
}

export function main(
  name: string,
  index: number,
  seed: string,
  script_first_run: boolean,
  label_first_run: boolean,
  type: 'train' | 'val' | 'test',
) {
  if (script_first_run) {
    helpers.write_file('factorio_yolo_dataset_v0/detect.yaml', `
train: images/train
val: images/val
test: images/test

names:
`, true)
  }

  if (label_first_run) {
    helpers.write_file('factorio_yolo_dataset_v0/detect.yaml', `  ${index}: ${name}\n`, true)
  }

  const entity_position = {
    x: capture_center.x + math.random(10) - 5,
    y: capture_center.y + math.random(10) - 5,
  }

  // const entity_position = {
  //   x: capture_center.x,
  //   y: capture_center.y,
  // }

  clear_entities()

  const entity = surface.create_entity({
    name,
    position: entity_position,
  })

  if (!entity) {
    error(`Failed to create entity ${name}`)
  }

  const selection_box = entity.selection_box
  rcon.print(`selection box: ${selection_box.left_top.x}, ${selection_box.left_top.y}, ${selection_box.right_bottom.x}, ${selection_box.right_bottom.y}`)

  const daytime = math.random()
  // const daytime = 1
  surface.daytime = daytime

  const zoom = math.random(0.5, 4)
  // const zoom = 2
  player.zoom = zoom

  const capture_box = calc_capture_box(zoom)

  rcon.print(`capture box: ${capture_box.left_top.x}, ${capture_box.left_top.y}, ${capture_box.right_bottom.x}, ${capture_box.right_bottom.y}`)

  // name standard: {name}_{daytime}_{zoom}_{surface}_{seed}_{left_top_x}_{left_top_y}_{right_bottom_x}_{right_bottom_y}
  const name_with_label = `${name}_${daytime}_${zoom}_${surface_name}_${seed}_${selection_box.left_top.x}_${selection_box.left_top.y}_${selection_box.right_bottom.x}_${selection_box.right_bottom.y}`

  game.take_screenshot({
    position: capture_center,
    resolution,
    daytime,
    zoom,
    path: `factorio_yolo_dataset_v0/images/${type}/${name_with_label}.jpg`,
  })

  const yolo_label = selection_box_to_yolo_label(capture_box, selection_box)
  rcon.print(`yolo label: ${index} ${yolo_label}`)

  helpers.write_file(`factorio_yolo_dataset_v0/labels/${type}/${name_with_label}.txt`, `${index} ${yolo_label}`, true)
}
