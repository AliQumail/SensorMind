import type { TagStatus } from '../../api/types'
import { STATUS_LABEL } from '../../lib/status'
import { StatusDot } from '../sensors/StatusBadge'

const STATUSES: TagStatus[] = ['normal', 'warning', 'alarm']

export function SceneLegend() {
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-wrap items-end justify-between gap-2 text-xs text-text-muted">
      <div className="flex gap-3 rounded-lg border border-border bg-surface-raised/90 px-3 py-1.5 shadow-soft backdrop-blur">
        {STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <StatusDot status={status} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>
      <span className="rounded-lg bg-surface-raised/80 px-2 py-1 backdrop-blur">
        Drag to orbit · right-drag to pan · scroll to zoom
      </span>
    </div>
  )
}
