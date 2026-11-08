import { useSyncExternalStore } from 'react'
import type { TagStatus } from '../api/types'
import { getThemeColors } from './themeColors'

const query = window.matchMedia('(prefers-reduced-motion: reduce)')

export const prefersReducedMotion = () => query.matches

export function useReducedMotion() {
  return useSyncExternalStore((onChange) => {
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, prefersReducedMotion)
}

/** Pulse frequency in Hz for the 3D scene, from the same tokens the CSS pulse uses. */
export function pulseHz(status: 'warning' | 'alarm') {
  const { pulseWarning, pulseAlarm } = getThemeColors()
  return 1 / parseFloat(status === 'alarm' ? pulseAlarm : pulseWarning)
}

export const isFlagged = (status: TagStatus | undefined): status is 'warning' | 'alarm' =>
  status === 'warning' || status === 'alarm'
