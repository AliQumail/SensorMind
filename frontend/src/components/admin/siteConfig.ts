import type { AssetShape, AssetType } from '../../api/types'

// The plant config JSON as the API stores it (the document format, not the API's response model).

export interface TagConfig {
  id: string
  name: string
  unit: string
  nominalMin: number
  nominalMax: number
  alarmLow?: number
  alarmHigh?: number
}

export interface AssetConfig {
  id: string
  name: string
  type: AssetType
  manufacturer: string
  model: string
  description?: string
  position: { x: number; z: number }
  size: { x: number; y: number; z: number }
  shape: AssetShape
  tags: TagConfig[]
}

export interface FloorConfig {
  id: string
  name: string
  level: number
  size: { width: number; depth: number }
  assets: AssetConfig[]
}

export interface SiteConfig {
  schemaVersion: 1
  site: { id: string; name: string; location?: string; floors: FloorConfig[] }
}

/** One document for a new tenant and everything under it. Sites have no schemaVersion here; the API adds it. */
export interface TenantConfig {
  tenant: string
  sites: SiteConfig['site'][]
}

export const EMPTY_TENANT: TenantConfig = { tenant: '', sites: [] }

function isSiteShape(site: SiteConfig['site'] | null | undefined): boolean {
  return (
    !!site &&
    Array.isArray(site.floors) &&
    site.floors.every(
      (f) =>
        f?.size &&
        Array.isArray(f.assets) &&
        f.assets.every((e) => e?.position && e.size && Array.isArray(e.tags) && e.tags.every(Boolean)),
    )
  )
}

export function isTenantConfig(value: unknown): value is TenantConfig {
  const config = value as TenantConfig | null
  return typeof config?.tenant === 'string' && Array.isArray(config.sites) && config.sites.every(isSiteShape)
}

export const ASSET_TYPES: AssetType[] = ['pump', 'compressor', 'motor', 'tank', 'fan', 'valve', 'heat-exchanger', 'other']
export const ASSET_SHAPES: AssetShape[] = ['box', 'cylinder', 'horizontal-cylinder', 'sphere']

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'

/** An id built from the name that does not collide with any of the taken ids. */
export function uniqueId(base: string, taken: Set<string>): string {
  const root = slug(base)
  let id = root
  for (let n = 2; taken.has(id); n++) id = `${root}-${n}`
  return id
}

export const allAssetIds = (config: SiteConfig) =>
  new Set(config.site.floors.flatMap((f) => f.assets.map((e) => e.id)))

export function newSite(name: string): SiteConfig {
  return {
    schemaVersion: 1,
    site: {
      // A short random suffix keeps site ids (and the tag ids built from them) unique across tenants.
      id: `site-${slug(name)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      floors: [
        {
          id: 'floor-ground',
          name: 'Ground Floor',
          level: 0,
          size: { width: 30, depth: 18 },
          assets: [],
        },
      ],
    },
  }
}

type TagTemplate = Omit<TagConfig, 'id'>

export interface AssetTemplate {
  label: string
  type: AssetType
  shape: AssetShape
  size: { x: number; y: number; z: number }
  tags: TagTemplate[]
}

export const ASSET_TEMPLATES: AssetTemplate[] = [
  {
    label: 'Pump',
    type: 'pump',
    shape: 'cylinder',
    size: { x: 0.7, y: 1.5, z: 0.7 },
    tags: [
      { name: 'Discharge Pressure', unit: 'bar', nominalMin: 3.6, nominalMax: 4.4, alarmLow: 2.8, alarmHigh: 5.2 },
      { name: 'Flow', unit: 'm³/h', nominalMin: 28, nominalMax: 34, alarmLow: 20 },
      { name: 'Motor Current', unit: 'A', nominalMin: 17, nominalMax: 22, alarmHigh: 26 },
      { name: 'Bearing Temperature', unit: '°C', nominalMin: 42, nominalMax: 62, alarmHigh: 80 },
    ],
  },
  {
    label: 'Compressor',
    type: 'compressor',
    shape: 'box',
    size: { x: 2, y: 1.8, z: 1.2 },
    tags: [
      { name: 'Outlet Pressure', unit: 'bar', nominalMin: 6.8, nominalMax: 7.4, alarmLow: 6, alarmHigh: 8.2 },
      { name: 'Element Outlet Temperature', unit: '°C', nominalMin: 72, nominalMax: 95, alarmHigh: 110 },
      { name: 'Motor Speed', unit: 'rpm', nominalMin: 2200, nominalMax: 3600, alarmHigh: 3900 },
    ],
  },
  {
    label: 'Motor',
    type: 'motor',
    shape: 'horizontal-cylinder',
    size: { x: 1, y: 0.6, z: 0.6 },
    tags: [
      { name: 'Winding Temperature', unit: '°C', nominalMin: 50, nominalMax: 90, alarmHigh: 120 },
      { name: 'Vibration (RMS)', unit: 'mm/s', nominalMin: 0.6, nominalMax: 2.8, alarmHigh: 7.1 },
    ],
  },
  {
    label: 'Tank',
    type: 'tank',
    shape: 'cylinder',
    size: { x: 2, y: 3, z: 2 },
    tags: [
      { name: 'Level', unit: '%', nominalMin: 40, nominalMax: 85, alarmLow: 15, alarmHigh: 95 },
      { name: 'Temperature', unit: '°C', nominalMin: 15, nominalMax: 30, alarmHigh: 45 },
    ],
  },
  { label: 'Blank asset', type: 'other', shape: 'box', size: { x: 1, y: 1, z: 1 }, tags: [] },
]

export function newAsset(template: AssetTemplate, config: SiteConfig): AssetConfig {
  const id = uniqueId(template.label, allAssetIds(config))
  return {
    id,
    name: template.label,
    type: template.type,
    manufacturer: 'Generic',
    model: template.label,
    position: { x: 2, z: 2 },
    size: { ...template.size },
    shape: template.shape,
    // Tag ids are global across sites (the sensor store is keyed by them), so they carry the site id.
    tags: template.tags.map((tag) => ({ ...tag, id: `${config.site.id}.${id}.${slug(tag.name)}` })),
  }
}
