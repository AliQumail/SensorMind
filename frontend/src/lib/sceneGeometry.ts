import type { EquipmentGroup, Floor } from '../api/types'

const ZONE_PADDING = 1.2

/**
 * Plant files place equipment relative to the floor corner; the scene centres each floor on the
 * world origin so the camera can orbit around it.
 */
export function toWorld(floor: Floor, x: number, y: number, z: number): [number, number, number] {
  return [x - floor.size.width / 2, y, z - floor.size.depth / 2]
}

/** Padded footprint of a group's equipment in floor coordinates, clamped to the floor. */
export function groupBounds(group: EquipmentGroup, floor: Floor) {
  if (group.equipment.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const { placement } of group.equipment) {
    const r = (placement.rotationDeg * Math.PI) / 180
    const halfX = (Math.abs(Math.cos(r)) * placement.size.x + Math.abs(Math.sin(r)) * placement.size.z) / 2
    const halfZ = (Math.abs(Math.sin(r)) * placement.size.x + Math.abs(Math.cos(r)) * placement.size.z) / 2
    minX = Math.min(minX, placement.position.x - halfX)
    maxX = Math.max(maxX, placement.position.x + halfX)
    minZ = Math.min(minZ, placement.position.z - halfZ)
    maxZ = Math.max(maxZ, placement.position.z + halfZ)
  }
  return {
    minX: Math.max(0, minX - ZONE_PADDING),
    maxX: Math.min(floor.size.width, maxX + ZONE_PADDING),
    minZ: Math.max(0, minZ - ZONE_PADDING),
    maxZ: Math.min(floor.size.depth, maxZ + ZONE_PADDING),
  }
}
