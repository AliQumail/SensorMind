import { useConnectionState, type ConnectionState } from '../../state/readingsStore'

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'bg-border-strong' },
  live: { label: 'Live', dot: 'bg-normal' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning animate-pulse' },
}

export function AppHeader({ siteName }: { siteName?: string }) {
  const connection = CONNECTION[useConnectionState()]

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
        <div>
          <h1 className="text-base leading-tight font-semibold">SensorMind</h1>
          <p className="text-xs text-text-muted">{siteName ?? 'Industrial IoT sensor intelligence'}</p>
        </div>
      </div>
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-text-muted">
        <span className={`size-2 rounded-full ${connection.dot}`} />
        {connection.label}
      </div>
    </header>
  )
}
