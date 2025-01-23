import type { MapPositionStruct } from 'factorio:prototype'

export function distance(a: MapPositionStruct, b: MapPositionStruct) {
  return math.sqrt(math.pow(a.x - b.x, 2) + math.pow(a.y - b.y, 2))
}
