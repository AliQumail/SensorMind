import { useEffect, useRef, useState } from 'react'
import type { SiteSummary, Tenant } from '../../api/types'
import { useConnectionState, type ConnectionState } from '../../state/readingsStore'

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  connecting: { label: 'Connecting…', dot: 'bg-border-strong' },
  live: { label: 'Live', dot: 'bg-normal' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning animate-pulse' },
}

export interface HeaderNav {
  tenants: Tenant[]
  sites: SiteSummary[]
  siteId: string | null
  onSelectSite: (siteId: string) => void
  isAdmin: boolean
  onAddTenant: () => void
  onEditTenant: (tenantId: string) => void
  onLogout: () => void
}

function Icon({ d, className = 'size-4' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS = {
  chevron: 'M3 6l5 5 5-5',
  tenant: 'M3 13.5v-11h6.5v11M9.5 6.5H13v7M1.5 13.5h13M5.5 5h1.5M5.5 7.5h1.5M5.5 10h1.5',
  site: 'M8 14s4.5-4.2 4.5-8a4.5 4.5 0 1 0-9 0c0 3.8 4.5 8 4.5 8zM8 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  edit: 'M10.5 3l2.5 2.5L5.5 13H3v-2.5L10.5 3z',
  signOut: 'M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11l3-3-3-3M13.5 8H6',
}

function TenantMenu({ nav }: { nav: HeaderNav }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const site = nav.sites.find((s) => s.id === nav.siteId)
  const tenant = nav.tenants.find((t) => t.id === site?.tenantId)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-surface-hover"
      >
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 shrink-0" />
        <span className="min-w-0">
          <span className="block text-base leading-tight font-semibold">SensorMind</span>
          <span className="block truncate text-xs text-text-muted">
            {tenant && site ? `${tenant.name}: ${site.name}` : 'Select a tenant'}
          </span>
        </span>
        <Icon d={ICONS.chevron} className={`size-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-[75vh] w-80 max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto rounded-lg border border-border bg-surface-raised p-2 shadow-soft">
          {nav.tenants.map((t) => {
            const sites = nav.sites.filter((s) => s.tenantId === t.id)
            return (
              <section key={t.id} aria-label={`Tenant ${t.name}`} className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center gap-2 bg-surface-hover px-3 py-2">
                  <Icon d={ICONS.tenant} className="size-5 text-accent-text" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] font-semibold tracking-wider text-text-muted uppercase">Tenant</p>
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                  </div>
                  {nav.isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        nav.onEditTenant(t.id)
                        setOpen(false)
                      }}
                      aria-label={`Edit tenant ${t.name}`}
                      title="Edit tenant"
                      className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-surface-raised hover:text-text"
                    >
                      <Icon d={ICONS.edit} />
                    </button>
                  )}
                </div>

                <div className="p-1">
                  <p className="px-2 pt-1 pb-0.5 text-[0.65rem] font-semibold tracking-wider text-text-muted uppercase">Sites</p>
                  {sites.length === 0 && <p className="px-2 py-1 text-sm text-text-muted italic">No sites yet</p>}
                  {sites.map((s) => {
                    const selected = s.id === nav.siteId
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => {
                          nav.onSelectSite(s.id)
                          setOpen(false)
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover ${
                          selected ? 'bg-accent-soft font-medium text-accent-text' : ''
                        }`}
                      >
                        <Icon d={ICONS.site} className="size-4 text-text-muted" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
          {nav.isAdmin && (
            <button
              type="button"
              onClick={() => {
                nav.onAddTenant()
                setOpen(false)
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-accent-text hover:bg-surface-hover"
            >
              + Add new tenant
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AppHeader({ nav }: { nav: HeaderNav }) {
  const connection = CONNECTION[useConnectionState()]

  return (
    <header className="mb-3 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-raised px-3 py-2 shadow-soft">
      <TenantMenu nav={nav} />

      <div className="flex shrink-0 items-center gap-3">
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-text-muted">
          <span className={`size-2 rounded-full ${connection.dot}`} />
          {connection.label}
        </div>
        <button
          type="button"
          onClick={nav.onLogout}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
        >
          <Icon d={ICONS.signOut} />
        </button>
      </div>
    </header>
  )
}
