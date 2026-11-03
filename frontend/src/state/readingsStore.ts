import { useSyncExternalStore } from 'react'
import { readingsStreamUrl } from '../api/client'
import type { Reading } from '../api/types'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting'

/**
 * Latest reading per tag, fed by the API's Server-Sent Events stream. Kept outside React so that
 * every component subscribes only to what it reads (via useSyncExternalStore selectors).
 * Each batch produces a new Map, which keeps snapshots immutable.
 */
class ReadingsStore {
  private readings: ReadonlyMap<string, Reading> = new Map()
  private connection: ConnectionState = 'connecting'
  private readonly listeners = new Set<() => void>()

  connect(url = readingsStreamUrl()): () => void {
    const source = new EventSource(url)
    source.addEventListener('readings', (event) => this.apply(JSON.parse(event.data) as Reading[]))
    source.onopen = () => this.setConnection('live')
    // EventSource reconnects on its own (the server sends retry: 3000).
    source.onerror = () => this.setConnection('reconnecting')
    return () => source.close()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getReadings = () => this.readings

  getConnection = () => this.connection

  private apply(batch: Reading[]) {
    const next = new Map(this.readings)
    for (const reading of batch) next.set(reading.tagId, reading)
    this.readings = next
    this.connection = 'live'
    this.emit()
  }

  private setConnection(state: ConnectionState) {
    if (this.connection === state) return
    this.connection = state
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export const readingsStore = new ReadingsStore()

export const useReadings = () => useSyncExternalStore(readingsStore.subscribe, readingsStore.getReadings)

export const useReading = (tagId: string) =>
  useSyncExternalStore(readingsStore.subscribe, () => readingsStore.getReadings().get(tagId))

export const useConnectionState = () => useSyncExternalStore(readingsStore.subscribe, readingsStore.getConnection)
