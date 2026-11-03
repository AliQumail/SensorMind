import type { TagStatus } from '../../api/types'
import { STATUS_LABEL } from '../../lib/status'

const DOT: Record<TagStatus, string> = {
  normal: 'bg-normal',
  warning: 'bg-warning',
  alarm: 'bg-alarm',
}

const BADGE: Record<TagStatus, string> = {
  normal: 'bg-normal/12 text-normal-text ring-normal/30',
  warning: 'bg-warning/15 text-warning-text ring-warning/40',
  alarm: 'bg-alarm/12 text-alarm-text ring-alarm/35',
}

/** Colour is never the only signal: the dot carries a title and badges always show the label. */
export function StatusDot({ status, className = '' }: { status: TagStatus | undefined; className?: string }) {
  return (
    <span
      title={status ? STATUS_LABEL[status] : 'No data'}
      className={`inline-block size-2 shrink-0 rounded-full ${status ? DOT[status] : 'bg-border-strong'} ${
        status === 'alarm' ? 'animate-pulse' : ''
      } ${className}`}
    />
  )
}

export function StatusBadge({ status }: { status: TagStatus | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-text-muted ring-1 ring-border ring-inset">
        No data
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[status]}`}
    >
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  )
}
