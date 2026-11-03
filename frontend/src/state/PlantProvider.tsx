import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { PlantIndex } from '../lib/plantIndex'
import { PlantContext, type PlantContextValue, type Selection } from './plantContext'

export function PlantProvider({ index, children }: { index: PlantIndex; children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null)
  const [activeFloorId, setActiveFloor] = useState(() => index.floors[0].id)

  const select = useCallback(
    (next: Selection) => {
      setSelection(next)
      const floorId = next && floorOf(index, next)
      if (floorId) setActiveFloor(floorId)
    },
    [index],
  )

  const value = useMemo<PlantContextValue>(
    () => ({ index, selection, activeFloorId, select, setActiveFloor }),
    [index, selection, activeFloorId, select],
  )

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>
}

function floorOf(index: PlantIndex, selection: NonNullable<Selection>): string | undefined {
  switch (selection.kind) {
    case 'floor':
      return selection.id
    case 'group':
      return index.groupById.get(selection.id)?.floor.id
    case 'equipment':
      return index.equipmentById.get(selection.id)?.floor.id
    default:
      return undefined
  }
}
