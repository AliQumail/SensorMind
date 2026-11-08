import type { Asset } from '../../api/types'
import { formatAssetType } from '../../lib/format'
import { floorAssets, siteAssets } from '../../lib/plantIndex'
import { assetStatus, statusSeverity } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { StatusBadge, StatusDot } from './StatusBadge'
import { TagRow } from './TagRow'

export function SensorPanel() {
  const { index, selection, activeFloorId } = usePlant()

  if (selection?.kind === 'asset') {
    const entry = index.assetById.get(selection.id)
    if (entry) return <AssetDetail asset={entry.asset} context={entry.floor.name} />
  }

  // Anything else shows an overview of the selected scope (defaulting to the visible floor).
  if (selection?.kind === 'site') {
    return <Overview title={index.plant.site.name} subtitle="All floors" assets={siteAssets(index)} />
  }
  const floor = index.floorById.get(selection?.kind === 'floor' ? selection.id : activeFloorId) ?? index.floors[0]
  return <Overview title={floor.name} subtitle="Select an asset in the tree or 3D view" assets={floorAssets(floor)} />
}

/** The section's header bar content: the selected scope's name, plus the asset's status badge. */
export function SensorPanelTitle() {
  const { index, selection, activeFloorId } = usePlant()
  const readings = useReadings()

  const entry = selection?.kind === 'asset' ? index.assetById.get(selection.id) : undefined
  if (entry) {
    return (
      <>
        <span className="truncate">{entry.asset.name}</span>
        <StatusBadge status={assetStatus(entry.asset, readings)} />
      </>
    )
  }
  if (selection?.kind === 'site') return <span className="truncate">{index.plant.site.name}</span>
  const floor = index.floorById.get(selection?.kind === 'floor' ? selection.id : activeFloorId) ?? index.floors[0]
  return <span className="truncate">{floor.name}</span>
}

function AssetDetail({ asset, context }: { asset: Asset; context: string }) {
  return (
    <section aria-label={`Sensors for ${asset.name}`} className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 pt-4 pb-3">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{context}</p>
        <p className="mt-1 text-sm text-text-muted">
          {formatAssetType(asset.type)} · {asset.manufacturer} {asset.model}
        </p>
        {asset.description && <p className="mt-2 text-sm leading-relaxed">{asset.description}</p>}
      </header>

      {asset.tags.length === 0 ? (
        <p className="p-4 text-sm text-text-muted">This asset has no sensor tags.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {asset.tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Overview({ title, subtitle, assets }: { title: string; subtitle: string; assets: Asset[] }) {
  const { select } = usePlant()
  const readings = useReadings()

  const rows = assets
    .map((e) => ({ asset: e, status: assetStatus(e, readings) }))
    .sort((a, b) => statusSeverity(b.status) - statusSeverity(a.status) || a.asset.name.localeCompare(b.asset.name))
  const alarms = rows.filter((r) => r.status === 'alarm').length
  const warnings = rows.filter((r) => r.status === 'warning').length

  return (
    <section aria-label={`Overview of ${title}`} className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-4 py-3">
        <p className="text-sm text-text-muted">{subtitle}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Assets" value={rows.length} />
          <Stat label="Warnings" value={warnings} tone={warnings > 0 ? 'text-warning-text' : undefined} />
          <Stat label="Alarms" value={alarms} tone={alarms > 0 ? 'text-alarm-text' : undefined} />
        </dl>
      </header>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {rows.map(({ asset: e, status }) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => select({ kind: 'asset', id: e.id })}
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
