import { useEffect, useState } from 'react'
import { fetchPlant } from './api/client'
import { ChatPanel } from './components/chat/ChatPanel'
import { AppHeader } from './components/layout/AppHeader'
import { Panel } from './components/layout/Panel'
import { PlantScene } from './components/scene/PlantScene'
import { SensorPanel } from './components/sensors/SensorPanel'
import { AssetTree } from './components/tree/AssetTree'
import { buildPlantIndex, type PlantIndex } from './lib/plantIndex'
import { PlantProvider } from './state/PlantProvider'
import { readingsStore } from './state/readingsStore'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; index: PlantIndex }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [treeOpen, setTreeOpen] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchPlant(controller.signal)
      .then((plant) => setState({ status: 'ready', index: buildPlantIndex(plant) }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => readingsStore.connect(), [])

  if (state.status !== 'ready') {
    return (
      <div className="flex h-full flex-col">
        <AppHeader />
        <main className="grid flex-1 place-items-center p-6 text-center">
          {state.status === 'loading' ? (
            <p className="text-text-muted">Loading plant…</p>
          ) : (
            <div className="max-w-md space-y-2">
              <p className="font-semibold text-alarm-text">Could not load the plant configuration.</p>
              <p className="text-sm text-text-muted">{state.message}. Is the API running?</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <PlantProvider index={state.index}>
      <div className="flex min-h-full flex-col lg:h-full">
        <AppHeader siteName={state.index.plant.site.name} />
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
      </div>
    </PlantProvider>
  )
}
