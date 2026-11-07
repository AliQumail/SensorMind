// Mirrors the .NET API contracts (camelCase JSON, kebab-case enums, epoch-ms timestamps).

export type AssetType =
  | 'refrigerator'
  | 'pump'
  | 'compressor'
  | 'motor'
  | 'tank'
  | 'fan'
  | 'valve'
  | 'heat-exchanger'
  | 'other'

export type AssetShape = 'box' | 'cylinder' | 'horizontal-cylinder' | 'sphere'

export type TagStatus = 'normal' | 'warning' | 'alarm'

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Tag {
  id: string
  name: string
  unit: string
  nominalMin: number
  nominalMax: number
  alarmLow?: number
  alarmHigh?: number
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  manufacturer: string
  model: string
  description?: string
  placement: {
    position: Vector3
    size: Vector3
    rotationDeg: number
    shape: AssetShape
  }
  tags: Tag[]
}

export interface Floor {
  id: string
  name: string
  level: number
  size: { width: number; depth: number }
  assets: Asset[]
}

export interface Site {
  id: string
  name: string
  location?: string
  floors: Floor[]
}

export interface Plant {
  schemaVersion: number
  site: Site
}

export interface Reading {
  tagId: string
  ts: number
  value: number
  status: TagStatus
}

export interface TagHistory {
  tagId: string
  unit: string
  from: number
  to: number
  points: { t: number; v: number }[]
}

export interface Tenant {
  id: string
  name: string
}

export interface SiteSummary {
  id: string
  tenantId: string
  name: string
}

export interface ValidationError {
  path: string
  message: string
}
