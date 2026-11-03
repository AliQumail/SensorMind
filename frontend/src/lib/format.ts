const formatters = new Map<number, Intl.NumberFormat>()

function formatter(decimals: number) {
  let f = formatters.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    formatters.set(decimals, f)
  }
  return f
}

/** Precision scaled to the magnitude of the nominal band, so 7.12 bar and 2981 rpm both read naturally. */
export function formatValue(value: number, nominalMin: number, nominalMax: number) {
  const span = Math.abs(nominalMax - nominalMin)
  const decimals = span >= 100 ? 0 : span >= 10 ? 1 : 2
  return formatter(decimals).format(value)
}

export function formatRange(min: number, max: number) {
  return `${formatValue(min, min, max)}–${formatValue(max, min, max)}`
}

const TYPE_LABEL: Record<string, string> = { 'heat-exchanger': 'Heat exchanger' }

export const formatEquipmentType = (type: string) => TYPE_LABEL[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
