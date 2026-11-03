import type { Equipment } from '../../api/types'
import { formatEquipmentType } from '../../lib/format'
import { floorEquipment, siteEquipment } from '../../lib/plantIndex'
import { equipmentStatus, statusSeverity } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { StatusBadge, StatusDot } from './StatusBadge'
import { TagRow } from './TagRow'

export function SensorPanel() {
  const { index, selection, activeFloorId } = usePlant()

  if (selection?.kind === 'equipment') {
    const entry = index.equipmentById.get(selection.id)
    if (entry) return <EquipmentDetail equipment={entry.equipment} context={`${entry.floor.name} · ${entry.group.name}`} />
  }

  // Anything else shows an overview of the selected scope (defaulting to the visible floor).
  if (selection?.kind === 'site') {
    return <Overview title={index.plant.site.name} subtitle="All floors" equipment={siteEquipment(index)} />
  }
  if (selection?.kind === 'group') {
    const entry = index.groupById.get(selection.id)
    if (entry) return <Overview title={entry.group.name} subtitle={entry.floor.name} equipment={entry.group.equipment} />
  }
  const floor = index.floorById.get(selection?.kind === 'floor' ? selection.id : activeFloorId) ?? index.floors[0]
  return <Overview title={floor.name} subtitle="Select equipment in the tree or 3D view" equipment={floorEquipment(floor)} />
}

function EquipmentDetail({ equipment, context }: { equipment: Equipment; context: string }) {
  const readings = useReadings()

  return (
    <section aria-label={`Sensors for ${equipment.name}`} className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 pt-4 pb-3">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{context}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h2 className="text-lg leading-tight font-semibold">{equipment.name}</h2>
          <StatusBadge status={equipmentStatus(equipment, readings)} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {formatEquipmentType(equipment.type)} · {equipment.manufacturer} {equipment.model}
        </p>
        {equipment.description && <p className="mt-2 text-sm leading-relaxed">{equipment.description}</p>}
      </header>

      {equipment.tags.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">This asset has no sensor tags.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {equipment.tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Overview({ title, subtitle, equipment }: { title: string; subtitle: string; equipment: Equipment[] }) {
  const { select } = usePlant()
  const readings = useReadings()

  const rows = equipment
    .map((e) => ({ equipment: e, status: equipmentStatus(e, readings) }))
    .sort((a, b) => statusSeverity(b.status) - statusSeverity(a.status) || a.equipment.name.localeCompare(b.equipment.name))
  const alarms = rows.filter((r) => r.status === 'alarm').length
  const warnings = rows.filter((r) => r.status === 'warning').length

  return (
    <section aria-label={`Overview of ${title}`} className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text-muted">{subtitle}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Assets" value={rows.length} />
          <Stat label="Warnings" value={warnings} tone={warnings > 0 ? 'text-warning-text' : undefined} />
          <Stat label="Alarms" value={alarms} tone={alarms > 0 ? 'text-alarm-text' : undefined} />
        </dl>
      </header>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {rows.map(({ equipment: e, status }) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => select({ kind: 'equipment', id: e.id })}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <StatusDot status={status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.name}</span>
                <span className="block truncate text-xs text-text-muted">
                  {e.manufacturer} {e.model}
                </span>
              </span>
              <StatusBadge status={status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-2 py-1.5">
      <dt className="text-[11px] tracking-wide text-text-muted uppercase">{label}</dt>
      <dd className={`font-mono text-lg font-semibold tabular ${tone ?? ''}`}>{value}</dd>
    </div>
  )
}
