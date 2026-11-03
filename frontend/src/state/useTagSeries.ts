import { useEffect, useState } from 'react'
import { fetchTagHistory } from '../api/client'
import { useReading } from './readingsStore'

export interface SeriesPoint {
  t: number
  v: number
}

/**
 * A rolling window for one tag: seeded from the history endpoint (downsampled), then extended
 * with live readings from the stream. Live points that arrive before the history response are kept.
 */
export function useTagSeries(tagId: string, windowMs: number, maxPoints = 90) {
  const [points, setPoints] = useState<SeriesPoint[]>([])
  const latest = useReading(tagId)

  useEffect(() => {
    const controller = new AbortController()
    setPoints([])
    fetchTagHistory(tagId, { from: new Date(Date.now() - windowMs), maxPoints }, controller.signal)
      .then((history) =>
        setPoints((live) => {
          const lastHistoric = history.points.at(-1)?.t ?? 0
          return [...history.points, ...live.filter((p) => p.t > lastHistoric)]
        }),
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn(`History for ${tagId} unavailable`, error)
      })
    return () => controller.abort()
  }, [tagId, windowMs, maxPoints])

  useEffect(() => {
    if (!latest) return
    setPoints((current) => {
      if (current.length > 0 && current[current.length - 1].t >= latest.ts) return current
      const cutoff = latest.ts - windowMs
      return [...current.filter((p) => p.t >= cutoff), { t: latest.ts, v: latest.value }]
    })
  }, [latest, windowMs])

  return points
}
