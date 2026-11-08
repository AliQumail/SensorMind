/**
 * Reads the CSS design tokens so the Three.js scene uses exactly the same palette as the DOM.
 * index.css is the single source of truth; nothing colour-related is duplicated here.
 */
const TOKENS = {
  bg: '--bg',
  surface: '--surface',
  border: '--border',
  borderStrong: '--border-strong',
  text: '--text',
  textMuted: '--text-muted',
  accent: '--accent',
  normal: '--status-normal',
  warning: '--status-warning',
  alarm: '--status-alarm',
  pulseWarning: '--pulse-warning',
  pulseAlarm: '--pulse-alarm',
  floor: '--scene-floor',
  grid: '--scene-grid',
  light: '--scene-light',
  refrigerator: '--equip-refrigerator',
  pump: '--equip-pump',
  compressor: '--equip-compressor',
  motor: '--equip-motor',
  tank: '--equip-tank',
  other: '--equip-other',
} as const

export type ThemeColors = Record<keyof typeof TOKENS, string>

let cached: ThemeColors | undefined

export function getThemeColors(): ThemeColors {
  if (!cached) {
    const style = getComputedStyle(document.documentElement)
    cached = Object.fromEntries(
      Object.entries(TOKENS).map(([key, token]) => [key, style.getPropertyValue(token).trim()]),
    ) as ThemeColors
  }
  return cached
}
