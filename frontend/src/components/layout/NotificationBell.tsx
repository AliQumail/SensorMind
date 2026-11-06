import { useContext, useEffect, useRef, useState } from 'react'
import { STATUS_LABEL } from '../../lib/status'
import { PlantContext } from '../../state/plantContext'
import { useNotifications, type Notification } from '../../state/useNotifications'

const DOT = { warning: 'bg-warning', alarm: 'bg-alarm' }
const TEXT = { warning: 'text-warning-text', alarm: 'text-alarm-text' }

function relativeTime(ts: number, now: number) {
  const minutes = Math.floor(Math.max(0, now - ts) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`
}

function NotificationList({
  now,
  items,
  onSelect,
  onClear,
}: {
  now: number
  items: Notification[]
  onSelect: (n: Notification) => void
  onClear: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute top-full right-0 z-20 mt-1 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-soft"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Notifications</h2>
        {items.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-accent-text hover:underline">
            Clear all
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-text-muted">No warnings or alarms</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto">
          {items.map((n) => (
            <li key={n.id} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => onSelect(n)} className="block w-full px-3 py-2.5 text-left hover:bg-surface-hover">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className={`flex items-center gap-1.5 font-semibold ${TEXT[n.severity]}`}>
                    <span className={`size-2 rounded-full ${DOT[n.severity]}`} />
                    {STATUS_LABEL[n.severity]}
                  </span>
                  <span className="text-text-muted">{relativeTime(n.ts, now)}</span>
                </span>
                <span className="mt-1 block truncate text-sm font-medium">{n.title}</span>
                <span className="block truncate text-xs text-text-muted">
                  {n.location} · {n.message}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Bell() {
  const { select } = useContext(PlantContext)!
  const { items, unread, markAllRead, clear } = useNotifications()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearInterval(tick)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // New items that arrive while the panel is open count as seen.
  useEffect(() => {
    if (open) markAllRead()
  }, [open, items, markAllRead])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setNow(Date.now())
          setOpen((value) => !value)
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        className="relative grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path
            d="M8 2a4 4 0 0 0-4 4c0 3.5-1.5 4.5-1.5 4.5h11S12 9.5 12 6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-alarm px-1 text-[0.65rem] leading-4 font-semibold text-white ring-2 ring-surface-raised"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <NotificationList
          now={now}
          items={items}
          onClear={clear}
          onSelect={(n) => {
            select({ kind: 'equipment', id: n.equipmentId })
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Shown only while a plant is loaded, since notifications come from the plant's tags. */
export function NotificationBell() {
  return useContext(PlantContext) ? <Bell /> : null
}
