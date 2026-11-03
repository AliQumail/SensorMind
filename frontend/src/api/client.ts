import type { Plant, TagHistory } from './types'

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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed with ${response.status}`)
  }
  return (await response.json()) as T
}

export const fetchPlant = (signal?: AbortSignal) => getJson<Plant>('/api/plant', signal)

export function fetchTagHistory(
  tagId: string,
  options: { from: Date; to?: Date; maxPoints?: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ from: options.from.toISOString() })
  if (options.to) query.set('to', options.to.toISOString())
  if (options.maxPoints) query.set('maxPoints', String(options.maxPoints))
  return getJson<TagHistory>(`/api/tags/${encodeURIComponent(tagId)}/history?${query}`, signal)
}

export const readingsStreamUrl = () => apiUrl('/api/readings/stream')
