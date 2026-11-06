import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChatChartData } from '../../api/client'

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Trend graph the assistant asked for, with the nominal band shaded. */
export function ChatChart({ chart }: { chart: ChatChartData }) {
  return (
    <figure className="mt-2 rounded-lg border border-border bg-surface-raised p-2">
      <figcaption className="px-1 text-xs font-medium">
        {chart.name} <span className="text-text-muted">({chart.unit})</span>
      </figcaption>
      {chart.points.length < 2 ? (
        <p className="px-1 py-4 text-xs text-text-muted">Not enough data for this period yet.</p>
      ) : (
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={time} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={32} />
              <YAxis domain={['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <ReferenceArea y1={chart.nominalMin} y2={chart.nominalMax} fill="var(--status-normal)" fillOpacity={0.1} stroke="none" />
              <Tooltip
                labelFormatter={(t) => time(Number(t))}
                formatter={(value) => [`${value} ${chart.unit}`, chart.name]}
                contentStyle={{ fontSize: 12, background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
              />
              <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
