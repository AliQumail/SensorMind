import { useEffect, useState } from 'react'
import {
  fetchMe,
  fetchPlant,
  fetchSites,
  fetchTenants,
  getToken,
  setToken,
  setUnauthorizedHandler,
  type LoginResult,
} from './api/client'
import type { SiteSummary, Tenant } from './api/types'
import { TenantModal } from './components/admin/TenantModal'
import { LoginPage } from './components/auth/LoginPage'
import { ChatPanel } from './components/chat/ChatPanel'
import { AppHeader, type HeaderNav } from './components/layout/AppHeader'
import { Panel } from './components/layout/Panel'
import { PlantLoader } from './components/layout/PlantLoader'
import { PlantScene } from './components/scene/PlantScene'
import { SensorPanel } from './components/sensors/SensorPanel'
import { AssetTree } from './components/tree/AssetTree'
import { buildPlantIndex, type PlantIndex } from './lib/plantIndex'
import { PlantProvider } from './state/PlantProvider'
import { readingsStore } from './state/readingsStore'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; index: PlantIndex; version: number }

function Workspace({ user, onLogout }: { user: { username: string; role: string }; onLogout: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [sites, setSites] = useState<SiteSummary[]>([])
  /** The reloadKey of the last loaded directory; null until the first load. */
  const [directoryVersion, setDirectoryVersion] = useState<number | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  /** The tenant open in the modal: an id to edit, null to add a new one. */
  const [tenantModal, setTenantModal] = useState<{ tenantId: string | null } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [treeOpen, setTreeOpen] = useState(true)

  // Tenants and sites; reloaded after every tenant change.
  useEffect(() => {
    Promise.all([fetchTenants(), fetchSites()])
      .then(([loadedTenants, loadedSites]) => {
        setTenants(loadedTenants)
        setSites(loadedSites)
        setSiteId((current) => (loadedSites.some((s) => s.id === current) ? current : (loadedSites[0]?.id ?? null)))
        setDirectoryVersion(reloadKey)
      })
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
      )
  }, [reloadKey])

  useEffect(() => {
    if (!siteId || directoryVersion === null) return
    const controller = new AbortController()
    fetchPlant(siteId, controller.signal)
      .then((plant) => setState({ status: 'ready', index: buildPlantIndex(plant), version: directoryVersion }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      })
    return () => controller.abort()
  // Follows directoryVersion, not reloadKey, so a deleted site is never fetched before the selection moves off it.
  }, [siteId, directoryVersion])

  useEffect(() => readingsStore.connect(), [])

  const isAdmin = user.role === 'admin'
  const reload = () => setReloadKey((k) => k + 1)

  const nav: HeaderNav = {
    tenants,
    sites,
    siteId,
    onSelectSite: setSiteId,
    isAdmin,
    onAddTenant: () => setTenantModal({ tenantId: null }),
    onEditTenant: (tenantId) => setTenantModal({ tenantId }),
    onLogout,
  }

  const layout = (
    <div className="flex min-h-full flex-col lg:h-full">
      <AppHeader nav={nav} />
      {directoryVersion !== null && !siteId ? (
        <main className="grid flex-1 place-items-center p-6 text-center text-text-muted">
          {isAdmin ? 'No sites yet. Add a tenant from the menu at the top left.' : 'No sites yet. Ask an admin to add one.'}
        </main>
      ) : state.status !== 'ready' ? (
        <main className="grid flex-1 place-items-center p-6 text-center">
          {state.status === 'loading' ? (
            <PlantLoader />
          ) : (
            <div className="max-w-md space-y-2">
              <p className="font-semibold text-alarm-text">Could not load the plant configuration.</p>
              <p className="text-sm text-text-muted">{state.message}. Is the API running?</p>
            </div>
          )}
        </main>
      ) : (
          <main
            className={`grid flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:min-h-0 lg:grid-cols-[var(--tree-width)_minmax(0,1fr)_minmax(340px,400px)] ${
              treeOpen ? '[--tree-width:300px]' : '[--tree-width:52px]'
            }`}
          >
            <Panel className="flex max-h-[40vh] flex-col lg:max-h-none">
              <div className="flex items-center justify-between border-b border-border px-2 py-2">
                {treeOpen && <h2 className="px-2 text-sm font-semibold">Assets</h2>}
                <button
                  type="button"
                  onClick={() => setTreeOpen((open) => !open)}
                  aria-label={treeOpen ? 'Collapse asset tree' : 'Expand asset tree'}
                  aria-expanded={treeOpen}
                  className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
                >
                  <svg viewBox="0 0 16 16" className={`size-4 transition-transform ${treeOpen ? '' : 'rotate-180'}`} aria-hidden>
                    <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {treeOpen && (
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <AssetTree />
                </div>
              )}
            </Panel>

            <div className="min-h-[60vh] lg:min-h-0">
              <PlantScene />
            </div>

            <div className="grid grid-rows-[32rem_22rem] gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,3fr)_minmax(0,2fr)]">
              <Panel>
                <SensorPanel />
              </Panel>
              <Panel>
                <ChatPanel />
              </Panel>
            </div>
          </main>
      )}

      {tenantModal && (
        <TenantModal
          key={tenantModal.tenantId ?? 'new'}
          tenantId={tenantModal.tenantId}
          onClose={() => setTenantModal(null)}
          onSaved={(firstSiteId) => {
            // A new tenant opens on its first site; an edit stays where it is.
            if (!tenantModal.tenantId && firstSiteId) setSiteId(firstSiteId)
            setTenantModal(null)
            reload()
          }}
          onDeleted={() => {
            setTenantModal(null)
            reload()
          }}
        />
      )}
    </div>
  )

  return state.status === 'ready' && !(directoryVersion !== null && !siteId) ? (
    <PlantProvider key={`${state.index.plant.site.id}:${state.version}`} index={state.index}>
      {layout}
    </PlantProvider>
  ) : (
    layout
  )
}

export default function App() {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)
  const [checking, setChecking] = useState(() => getToken() !== null)

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null
  if (!user) return <LoginPage onLoggedIn={(result: LoginResult) => setUser({ username: result.username, role: result.role })} />
  return <Workspace user={user} onLogout={logout} />
}
