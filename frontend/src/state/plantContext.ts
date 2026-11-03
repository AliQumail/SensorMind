import { createContext, useContext } from 'react'
import type { PlantIndex } from '../lib/plantIndex'

export type SelectionKind = 'site' | 'floor' | 'group' | 'equipment'

export type Selection = { kind: SelectionKind; id: string } | null

export interface PlantContextValue {
  index: PlantIndex
  selection: Selection
  activeFloorId: string
  /** Selecting a floor, group or equipment also switches the 3D view to its floor. */
  select: (selection: Selection) => void
  setActiveFloor: (floorId: string) => void
}

export const PlantContext = createContext<PlantContextValue | null>(null)

export function usePlant() {
  const value = useContext(PlantContext)
  if (!value) throw new Error('usePlant must be used inside <PlantProvider>')
  return value
}
