import type { Floor } from '../api/types'

/**
 * Plant files place assets relative to the floor corner; the scene centres each floor on the
 * world origin so the camera can orbit around it.
 */
export function toWorld(floor: Floor, x: number, y: number, z: number): [number, number, number] {
  return [x - floor.size.width / 2, y, z - floor.size.depth / 2]
}
