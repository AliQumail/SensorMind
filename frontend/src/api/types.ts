// Mirrors the .NET API contracts (camelCase JSON, kebab-case enums, epoch-ms timestamps).

export type EquipmentType =
  | 'pump'
  | 'compressor'
  | 'motor'
  | 'tank'
  | 'fan'
  | 'valve'
  | 'heat-exchanger'
  | 'other'

export type EquipmentShape = 'box' | 'cylinder' | 'horizontal-cylinder' | 'sphere'

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

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  manufacturer: string
  model: string
  description?: string
  placement: {
    position: Vector3
    size: Vector3
    rotationDeg: number
    shape: EquipmentShape
  }
  tags: Tag[]
}

export interface EquipmentGroup {
  id: string
  name: string
  equipment: Equipment[]
}

export interface Floor {
  id: string
  name: string
  level: number
  size: { width: number; depth: number }
  groups: EquipmentGroup[]
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
