import type { Equipment, EquipmentGroup, Floor, Plant } from '../api/types'

export interface EquipmentEntry {
  equipment: Equipment
  group: EquipmentGroup
  floor: Floor
}

export interface PlantIndex {
  plant: Plant
  floors: Floor[]
  floorById: Map<string, Floor>
  groupById: Map<string, { group: EquipmentGroup; floor: Floor }>
  equipmentById: Map<string, EquipmentEntry>
}

export function buildPlantIndex(plant: Plant): PlantIndex {
  const floors = [...plant.site.floors].sort((a, b) => a.level - b.level)
  const floorById = new Map<string, Floor>()
  const groupById = new Map<string, { group: EquipmentGroup; floor: Floor }>()
  const equipmentById = new Map<string, EquipmentEntry>()

  for (const floor of floors) {
    floorById.set(floor.id, floor)
    for (const group of floor.groups) {
      groupById.set(group.id, { group, floor })
      for (const equipment of group.equipment) {
        equipmentById.set(equipment.id, { equipment, group, floor })
      }
    }
  }

  return { plant, floors, floorById, groupById, equipmentById }
}

export const floorEquipment = (floor: Floor) => floor.groups.flatMap((g) => g.equipment)

export const siteEquipment = (index: PlantIndex) => index.floors.flatMap(floorEquipment)
