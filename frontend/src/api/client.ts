import type { TenantConfig } from '../components/admin/siteConfig'
import { toast } from '../state/toastStore'
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

const LOGIN_PATH = '/api/auth/login'

/** What the user reads for each failure. Never the server's own text, which may name internals. */
function friendlyMessage(status: number, path: string): string {
  if (status === 0) return "Can't reach the server. Check your connection and try again."
  if (status === 400) return "That request wasn't valid. Please check what you entered and try again."
  if (status === 401) return path === LOGIN_PATH ? 'Wrong username or password.' : 'Your session expired. Please sign in again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return "We couldn't find what you were looking for."
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'Something went wrong on our side. Please try again.'
  return 'Something went wrong. Please try again.'
}

const TOKEN_KEY = 'sensormind.token'

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** `remember` keeps the token across browser restarts (localStorage); otherwise it lasts for the tab (sessionStorage). */
export const setToken = (token: string | null, remember = false) => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable: the session just won't survive a reload.
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler
}

interface RequestOptions {
  body?: string
  signal?: AbortSignal
  headers?: Record<string, string>
  /** The caller shows the failure itself (inline), so no toast. */
  quiet?: boolean
}

async function request(method: string, path: string, { body, signal, headers, quiet }: RequestOptions = {}): Promise<Response> {
  const token = getToken()
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      body,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
    })
  } catch (error) {
    if (signal?.aborted) throw error
    const message = friendlyMessage(0, path)
    if (!quiet) toast.error(message)
    throw new ApiError(0, message)
  }

  if (response.status === 401 && token && path !== LOGIN_PATH) {
    onUnauthorized()
    toast.warning(friendlyMessage(401, path))
  } else if (!response.ok && !quiet && response.status !== 422) {
    // 422 is a validation list the editor shows next to the fields.
    toast.error(friendlyMessage(response.status, path))
  }
  return response
}

const failure = (response: Response, path: string) => new ApiError(response.status, friendlyMessage(response.status, path))

async function json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(method, path, options)
  if (!response.ok) throw failure(response, path)
  return (await response.json()) as T
}

export interface LoginResult {
  token: string
  username: string
  role: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await request('POST', LOGIN_PATH, { body: JSON.stringify({ username, password }) })
  if (!response.ok) throw failure(response, LOGIN_PATH)
  return (await response.json()) as LoginResult
}

export const fetchMe = () => json<{ username: string; role: string }>('GET', '/api/auth/me', { quiet: true })

export const fetchTenants = () => json<Tenant[]>('GET', '/api/tenants', { quiet: true })
export const fetchSites = () => json<SiteSummary[]>('GET', '/api/sites', { quiet: true })
export const fetchPlant = (siteId: string, signal?: AbortSignal) =>
  json<Plant>('GET', `/api/sites/${encodeURIComponent(siteId)}/plant`, { signal, quiet: true })
export const fetchTenantConfig = (tenantId: string) =>
  json<TenantConfig>('GET', `/api/tenants/${encodeURIComponent(tenantId)}/config`)

export async function deleteTenant(id: string) {
  const path = `/api/tenants/${encodeURIComponent(id)}`
  const response = await request('DELETE', path)
  if (!response.ok) throw failure(response, path)
}

export interface SaveOutcome {
  ok: boolean
  siteId?: string
  errors: ValidationError[]
}

/** Creates a tenant (tenantId null) or replaces an existing tenant and all its sites from one document. */
export async function saveTenant(tenantId: string | null, config: string): Promise<SaveOutcome> {
  const path = tenantId ? `/api/tenants/${encodeURIComponent(tenantId)}` : '/api/tenants'
  const response = await request(tenantId ? 'PUT' : 'POST', path, { body: config })
  if (response.ok) return { ok: true, siteId: ((await response.json()) as { siteId?: string }).siteId, errors: [] }
  if (response.status === 422) return { ok: false, errors: ((await response.json()) as { errors: ValidationError[] }).errors }
  throw failure(response, path)
}

export async function validateTenant(tenantId: string | null, config: string, signal?: AbortSignal): Promise<ValidationError[]> {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
  const path = `/api/tenants/validate${query}`
  const response = await request('POST', path, { body: config, signal, quiet: true })
  if (!response.ok) throw failure(response, path)
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
  return json<TagHistory>('GET', `/api/tags/${encodeURIComponent(tagId)}/history?${query}`, { signal, quiet: true })
}

/** EventSource cannot send headers, so the token travels as a query parameter. */
export const readingsStreamUrl = () => apiUrl(`/api/readings/stream?access_token=${encodeURIComponent(getToken() ?? '')}`)

export interface ChatChartData {
  tagId: string
  name: string
  unit: string
  nominalMin: number
  nominalMax: number
  points: { t: number; v: number }[]
}

export interface ChatCitation {
  source: string
  page: number
}

export interface ChatStatus {
  configured: boolean
  limit: number
  remaining: number
}

export const fetchChatStatus = () => json<ChatStatus>('GET', '/api/chat/status', { quiet: true })

export interface ChatHandlers {
  onToken: (text: string) => void
  onCitations: (citations: ChatCitation[]) => void
  onChart: (chart: ChatChartData) => void
  /** Free questions left today; null when the user's own key is used. */
  onDone: (remaining: number | null) => void
}

/** POSTs a question and reads the Server-Sent Events reply (fetch, because EventSource cannot POST). */
export async function askChat(
  body: { question: string; assetId?: string; history: { role: string; content: string }[] },
  userKey: string | null,
  handlers: ChatHandlers,
  signal: AbortSignal,
) {
  // Chat failures show inside the chat panel, so no toast.
  const response = await request('POST', '/api/chat', {
    body: JSON.stringify(body),
    signal,
    headers: userKey ? { 'X-OpenRouter-Key': userKey } : undefined,
    quiet: true,
  })
  if (!response.ok || !response.body) {
    const message = ((await response.json().catch(() => null)) as { message?: string } | null)?.message
    throw new ApiError(response.status, message ?? friendlyMessage(response.status, '/api/chat'))
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += value
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const raw of events) {
      const name = /^event: (.*)$/m.exec(raw)?.[1]
      const data = JSON.parse(/^data: (.*)$/m.exec(raw)?.[1] ?? 'null')
      if (name === 'token') handlers.onToken(data.text)
      else if (name === 'citations') handlers.onCitations(data)
      else if (name === 'chart') handlers.onChart(data)
      else if (name === 'done') handlers.onDone(data.remaining)
      else if (name === 'error') throw new Error(data.message)
    }
  }
}
