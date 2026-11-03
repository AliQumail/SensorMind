import { Line, LineChart, ReferenceArea, ResponsiveContainer, YAxis } from 'recharts'
import type { Tag, TagStatus } from '../../api/types'
import { useTagSeries } from '../../state/useTagSeries'

const WINDOW_MS = 15 * 60 * 1000

const STROKE: Record<TagStatus, string> = {
  normal: 'var(--status-normal)',
  warning: 'var(--status-warning)',
  alarm: 'var(--status-alarm)',
}

/** Last 15 minutes with the nominal band shaded, so excursions are visible at a glance. */
export function Sparkline({ tag, status }: { tag: Tag; status: TagStatus | undefined }) {
  const points = useTagSeries(tag.id, WINDOW_MS)
  const domain = yDomain(points.map((p) => p.v), tag)

  return (
    <div className="h-8 w-full" aria-hidden>
      {points.length > 1 && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <YAxis hide domain={domain} />
            <ReferenceArea y1={tag.nominalMin} y2={tag.nominalMax} fill="var(--status-normal)" fillOpacity={0.1} stroke="none" />
            <Line
              type="monotone"
              dataKey="v"
              stroke={status ? STROKE[status] : 'var(--text-muted)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function yDomain(values: number[], tag: Tag): [number, number] {
  const min = Math.min(tag.nominalMin, ...values)
  const max = Math.max(tag.nominalMax, ...values)
  const pad = (max - min) * 0.08
  return [min - pad, max + pad]
}
