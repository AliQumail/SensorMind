import type { Tag } from '../../api/types'
import { formatRange, formatValue } from '../../lib/format'
import { STATUS_LABEL } from '../../lib/status'
import { useReading } from '../../state/readingsStore'
import { Sparkline } from './Sparkline'
import { StatusDot } from './StatusBadge'

const VALUE_COLOR = {
  normal: 'text-text',
  warning: 'text-warning-text',
  alarm: 'text-alarm-text',
} as const

export function TagRow({ tag }: { tag: Tag }) {
  const reading = useReading(tag.id)
  const status = reading?.status

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface-raised px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot status={status} />
        <span className="truncate text-sm font-medium">{tag.name}</span>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className={`font-mono text-base font-semibold tabular ${status ? VALUE_COLOR[status] : 'text-text-muted'}`}>
          {reading ? formatValue(reading.value, tag.nominalMin, tag.nominalMax) : '—'}
        </span>
        <span className="ml-1 text-xs text-text-muted">{tag.unit}</span>
      </div>

      <div className="text-xs text-text-muted">
        Nominal <span className="font-mono">{formatRange(tag.nominalMin, tag.nominalMax)}</span>
        {status && status !== 'normal' && <span className={`ml-2 font-medium ${VALUE_COLOR[status]}`}>{STATUS_LABEL[status]}</span>}
      </div>
      <div className="w-28">
        <Sparkline tag={tag} status={status} />
      </div>
    </li>
  )
}
