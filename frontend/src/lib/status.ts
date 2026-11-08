import type { Asset, Reading, TagStatus } from '../api/types'

const SEVERITY: Record<TagStatus, number> = { normal: 0, warning: 1, alarm: 2 }

/** CSS class (index.css) that makes a status dot, or the bell, pulse. */
export const PULSE: Record<TagStatus, string> = { normal: '', warning: 'pulse-warning', alarm: 'pulse-alarm' }

export const STATUS_LABEL: Record<TagStatus, string> = { normal: 'Normal', warning: 'Warning', alarm: 'Alarm' }

/** Undefined when nothing is known yet (no readings received), so the UI can show "no data". */
export function worstStatus(statuses: Iterable<TagStatus | undefined>): TagStatus | undefined {
  let worst: TagStatus | undefined
  for (const status of statuses) {
    if (status && (!worst || SEVERITY[status] > SEVERITY[worst])) worst = status
  }
  return worst
}

export const assetStatus = (asset: Asset, readings: ReadonlyMap<string, Reading>) =>
  worstStatus(asset.tags.map((t) => readings.get(t.id)?.status))

export const statusSeverity = (status: TagStatus | undefined) => (status ? SEVERITY[status] : -1)
