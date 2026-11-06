import type { Asset, Floor, Plant } from '../api/types'

export interface AssetEntry {
  asset: Asset
  floor: Floor
}

export interface PlantIndex {
  plant: Plant
  floors: Floor[]
  floorById: Map<string, Floor>
  assetById: Map<string, AssetEntry>
}

export function buildPlantIndex(plant: Plant): PlantIndex {
  const floors = [...plant.site.floors].sort((a, b) => a.level - b.level)
  const floorById = new Map<string, Floor>()
  const assetById = new Map<string, AssetEntry>()

  for (const floor of floors) {
    floorById.set(floor.id, floor)
    for (const asset of floor.assets) {
      assetById.set(asset.id, { asset, floor })
    }
  }

  return { plant, floors, floorById, assetById }
}

export const floorAssets = (floor: Floor) => floor.assets

export const siteAssets = (index: PlantIndex) => index.floors.flatMap(floorAssets)
