import type { TenantConfig } from '../components/admin/siteConfig'
import type { Plant, SiteSummary, TagHistory, Tenant, ValidationError } from './types'

/** Empty in dev (Vite proxies /api); the deployed API origin in production. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TOKEN_KEY = 'sensormind.token'

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable: the session just won't survive a reload.
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler
}

async function request(method: string, path: string, body?: string, signal?: AbortSignal): Promise<Response> {
  const token = getToken()
  const response = await fetch(apiUrl(path), {
    method,
    signal,
    body,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })
  if (response.status === 401 && token) onUnauthorized()
  return response
}

async function json<T>(method: string, path: string, body?: string, signal?: AbortSignal): Promise<T> {
  const response = await request(method, path, body, signal)
  if (!response.ok) throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`)
  return (await response.json()) as T
}

export interface LoginResult {
  token: string
  username: string
  role: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await request('POST', '/api/auth/login', JSON.stringify({ username, password }))
  if (response.status === 401) throw new ApiError(401, 'Wrong username or password.')
  if (!response.ok) throw new ApiError(response.status, `Login failed with ${response.status}`)
  return (await response.json()) as LoginResult
}

export const fetchMe = () => json<{ username: string; role: string }>('GET', '/api/auth/me')

export const fetchTenants = () => json<Tenant[]>('GET', '/api/tenants')
export const fetchSites = () => json<SiteSummary[]>('GET', '/api/sites')
export const fetchPlant = (siteId: string, signal?: AbortSignal) =>
  json<Plant>('GET', `/api/sites/${encodeURIComponent(siteId)}/plant`, undefined, signal)
export const fetchTenantConfig = (tenantId: string) =>
  json<TenantConfig>('GET', `/api/tenants/${encodeURIComponent(tenantId)}/config`)

export async function deleteTenant(id: string) {
  const response = await request('DELETE', `/api/tenants/${encodeURIComponent(id)}`)
  if (!response.ok) throw new ApiError(response.status, `Deleting the tenant failed with ${response.status}`)
}

export interface SaveOutcome {
  ok: boolean
  siteId?: string
  errors: ValidationError[]
}

/** Creates a tenant (tenantId null) or replaces an existing tenant and all its sites from one document. */
export async function saveTenant(tenantId: string | null, config: string): Promise<SaveOutcome> {
  const response = tenantId
    ? await request('PUT', `/api/tenants/${encodeURIComponent(tenantId)}`, config)
    : await request('POST', '/api/tenants', config)
  if (response.ok) return { ok: true, siteId: ((await response.json()) as { siteId?: string }).siteId, errors: [] }
  if (response.status === 422) return { ok: false, errors: ((await response.json()) as { errors: ValidationError[] }).errors }
  throw new ApiError(response.status, `Saving failed with ${response.status}`)
}

export async function validateTenant(tenantId: string | null, config: string, signal?: AbortSignal): Promise<ValidationError[]> {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  const response = await request('POST', `/api/tenants/validate${query}`, config, signal)
  if (!response.ok) throw new ApiError(response.status, `Validation failed with ${response.status}`)
  return ((await response.json()) as { errors: ValidationError[] }).errors
}

export function fetchTagHistory(
  tagId: string,
  options: { from: Date; to?: Date; maxPoints?: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ from: options.from.toISOString() })
  if (options.to) query.set('to', options.to.toISOString())
  if (options.maxPoints) query.set('maxPoints', String(options.maxPoints))
  return json<TagHistory>('GET', `/api/tags/${encodeURIComponent(tagId)}/history?${query}`, undefined, signal)
}

/** EventSource cannot send headers, so the token travels as a query parameter. */
export const readingsStreamUrl = () => apiUrl(`/api/readings/stream?access_token=${encodeURIComponent(getToken() ?? '')}`)
