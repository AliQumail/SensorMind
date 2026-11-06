import { useEffect, useState, type ReactNode } from 'react'
import type { Asset, TagStatus } from '../../api/types'
import { floorAssets, siteAssets } from '../../lib/plantIndex'
import { assetStatus, worstStatus } from '../../lib/status'
import { usePlant, type Selection, type SelectionKind } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { StatusDot } from '../sensors/StatusBadge'

export function AssetTree() {
  const { index, selection, select } = usePlant()
  const readings = useReadings()
  const site = index.plant.site
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([site.id, ...index.floors.map((f) => f.id)]),
  )

  // Reveal the selected node when it is chosen elsewhere (e.g. by clicking in 3D).
  useEffect(() => {
    if (selection?.kind !== 'asset') return
    const entry = index.assetById.get(selection.id)
    if (!entry) return
    setExpanded((prev) => {
      if (prev.has(entry.floor.id)) return prev
      return new Set([...prev, site.id, entry.floor.id])
    })
  }, [selection, index, site.id])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const statusOf = (assets: Asset[]) => worstStatus(assets.map((e) => assetStatus(e, readings)))

  const nodeProps = (kind: SelectionKind, id: string) => ({
    selected: selection?.kind === kind && selection.id === id,
    onSelect: () => select({ kind, id } satisfies Selection),
  })

  return (
    <ul role="tree" aria-label="Plant assets" className="space-y-0.5 text-sm">
      <TreeNode
        label={site.name}
        depth={0}
        status={statusOf(siteAssets(index))}
        expanded={expanded.has(site.id)}
        onToggle={() => toggle(site.id)}
        {...nodeProps('site', site.id)}
      >
        {index.floors.map((floor) => (
          <TreeNode
            key={floor.id}
            label={floor.name}
            meta={`L${floor.level}`}
            depth={1}
            status={statusOf(floorAssets(floor))}
            expanded={expanded.has(floor.id)}
            onToggle={() => toggle(floor.id)}
            {...nodeProps('floor', floor.id)}
          >
            {floor.assets.map((asset) => (
              <TreeNode
                key={asset.id}
                label={asset.name}
                depth={2}
                status={assetStatus(asset, readings)}
                {...nodeProps('asset', asset.id)}
              />
            ))}
          </TreeNode>
        ))}
      </TreeNode>
    </ul>
  )
}

interface TreeNodeProps {
  label: string
  meta?: string
  depth: number
  status: TagStatus | undefined
  selected: boolean
  onSelect: () => void
  expanded?: boolean
  onToggle?: () => void
  children?: ReactNode
}

function TreeNode({ label, meta, depth, status, selected, onSelect, expanded, onToggle, children }: TreeNodeProps) {
  const hasChildren = onToggle !== undefined

  return (
    <li role="treeitem" aria-selected={selected} aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-2 transition-colors ${
          selected ? 'bg-accent-soft text-text' : 'text-text hover:bg-surface-hover'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            className="grid size-6 shrink-0 place-items-center rounded-md text-text-muted hover:text-text"
          >
            <svg viewBox="0 0 16 16" className={`size-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden>
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={onSelect}
          className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left ${depth < 2 ? 'font-medium' : ''}`}
        >
          <StatusDot status={status} />
          <span className="truncate">{label}</span>
          {meta && <span className="ml-auto shrink-0 font-mono text-[11px] text-text-muted">{meta}</span>}
        </button>
        {selected && <span className="sr-only">(selected)</span>}
      </div>
      {hasChildren && expanded && <ul role="group">{children}</ul>}
    </li>
  )
}
