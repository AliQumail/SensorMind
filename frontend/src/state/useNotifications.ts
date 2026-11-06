import { useCallback, useEffect, useRef, useState } from 'react'
import type { TagStatus } from '../api/types'
import { formatValue } from '../lib/format'
import { statusSeverity } from '../lib/status'
import { usePlant } from './plantContext'
import { useReadings } from './readingsStore'

const MAX_NOTIFICATIONS = 50

export interface Notification {
  id: string
  severity: 'warning' | 'alarm'
  assetId: string
  title: string
  location: string
  message: string
  ts: number
  read: boolean
}

/**
 * Warning and alarm notifications, kept in memory. A tag raises one when it first reports a warning or alarm
 * (so assets already in that state at load are included) and again when it changes to a different one,
 * such as warning to alarm. Returning to normal raises nothing.
 */
export function useNotifications() {
  const { index } = usePlant()
  const readings = useReadings()
  const seen = useRef(new Map<string, TagStatus>())
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    const fresh: Notification[] = []
    for (const floor of index.floors) {
      for (const asset of floor.assets) {
        for (const tag of asset.tags) {
          const reading = readings.get(tag.id)
          if (!reading) continue
          const previous = seen.current.get(tag.id)
          seen.current.set(tag.id, reading.status)
          if (reading.status === 'normal' || reading.status === previous) continue
          fresh.push({
            id: `${tag.id}:${reading.ts}`,
            severity: reading.status,
            assetId: asset.id,
            title: `${asset.name}: ${tag.name}`,
            location: floor.name,
            message: `${formatValue(reading.value, tag.nominalMin, tag.nominalMax)} ${tag.unit}`,
            ts: reading.ts,
            read: false,
          })
        }
      }
    }
    if (fresh.length === 0) return
    // Oldest first within a batch, so reversing puts the newest (and, on a tie, the alarm) on top.
    fresh.sort((a, b) => a.ts - b.ts || statusSeverity(a.severity) - statusSeverity(b.severity))
    setItems((current) => [...fresh.reverse(), ...current].slice(0, MAX_NOTIFICATIONS))
  }, [readings, index])

  const markAllRead = useCallback(
    () => setItems((current) => (current.some((n) => !n.read) ? current.map((n) => ({ ...n, read: true })) : current)),
    [],
  )
  const clear = useCallback(() => setItems([]), [])

  return { items, unread: items.filter((n) => !n.read).length, markAllRead, clear }
}
