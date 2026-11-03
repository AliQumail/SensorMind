import { floorEquipment } from '../../lib/plantIndex'
import { equipmentStatus, worstStatus } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { StatusDot } from '../sensors/StatusBadge'

export function FloorSwitcher() {
  const { index, activeFloorId, setActiveFloor } = usePlant()
  const readings = useReadings()

  return (
    <div
      role="tablist"
      aria-label="Floors"
      className="absolute top-3 left-3 flex gap-1 rounded-xl border border-border bg-surface-raised/90 p-1 shadow-soft backdrop-blur"
    >
      {index.floors.map((floor) => {
        const active = floor.id === activeFloorId
        const status = worstStatus(floorEquipment(floor).map((e) => equipmentStatus(e, readings)))
        return (
          <button
            key={floor.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setActiveFloor(floor.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-accent-hover text-white' : 'text-text-muted hover:bg-surface-hover hover:text-text'
            }`}
          >
            <span className={`font-mono text-xs ${active ? 'text-white/80' : ''}`}>L{floor.level}</span>
            {floor.name}
            <StatusDot status={status} className={active ? 'ring-2 ring-white/70' : ''} />
          </button>
        )
      })}
    </div>
  )
}
