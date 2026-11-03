import { useEffect, useRef, useState } from 'react'
import { deleteTenant, fetchTenantConfig, saveTenant, validateTenant } from '../../api/client'
import { ConfigEditor } from './ConfigEditor'
import { SiteForm } from './SiteForm'
import { EMPTY_TENANT, isTenantConfig, newSite, type TenantConfig } from './siteConfig'
import { Button, Field, TextInput } from './ui'

function TenantForm({ config, onChange }: { config: TenantConfig; onChange: (config: TenantConfig) => void }) {
  const setSites = (sites: TenantConfig['sites']) => onChange({ ...config, sites })

  return (
    <div className="space-y-4">
      <Field label="Tenant name">
        <TextInput value={config.tenant} onChange={(tenant) => onChange({ ...config, tenant })} autoFocus />
      </Field>

      {config.sites.map((site, i) => (
        <section key={site.id} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Site {i + 1}</h3>
            <Button variant="danger" onClick={() => setSites(config.sites.filter((_, j) => j !== i))}>
              Remove site
            </Button>
          </div>
          <SiteForm
            config={{ schemaVersion: 1, site }}
            onChange={(next) => setSites(config.sites.map((s, j) => (j === i ? next.site : s)))}
          />
        </section>
      ))}

      <Button onClick={() => setSites([...config.sites, newSite('New Site').site])}>+ Add site</Button>
    </div>
  )
}

/** Sites in the saved document that the edited text no longer has. Unparseable text reports none; the server rejects it. */
function removedSites(original: TenantConfig, text: string): string[] {
  try {
    const ids = new Set((JSON.parse(text) as TenantConfig).sites.map((s) => s.id))
    return original.sites.filter((s) => !ids.has(s.id)).map((s) => s.name)
  } catch {
    return []
  }
}

interface Props {
  /** Null when adding a new tenant. */
  tenantId: string | null
  onClose: () => void
  onSaved: (firstSiteId?: string) => void
  onDeleted: () => void
}

/** Adds or edits a tenant and everything under it as one JSON document. */
export function TenantModal({ tenantId, onClose, onSaved, onDeleted }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [initial, setInitial] = useState<TenantConfig | null>(tenantId ? null : EMPTY_TENANT)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  useEffect(() => {
    if (!tenantId) return
    fetchTenantConfig(tenantId)
      .then(setInitial)
      .catch((error: unknown) => setFailure(error instanceof Error ? error.message : String(error)))
  }, [tenantId])

  const remove = async () => {
    if (!window.confirm(`Delete tenant "${initial?.tenant}" and all its sites? This cannot be undone.`)) return
    try {
      await deleteTenant(tenantId!)
      onDeleted()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    }
  }

  const save = (text: string) => {
    const removed = initial ? removedSites(initial, text) : []
    if (removed.length > 0 && !window.confirm(`Saving will delete: ${removed.join(', ')}. This cannot be undone.`)) {
      return Promise.resolve({ ok: false, errors: [] })
    }
    return saveTenant(tenantId, text)
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="tenant-modal-title"
      className="m-auto h-[85vh] w-[min(64rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border border-border bg-surface text-text shadow-soft backdrop:bg-text/40"
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tenant-modal-title" className="text-base font-semibold">
            {tenantId ? 'Edit tenant' : 'Add tenant'}
          </h2>
          <div className="flex items-center gap-2">
            {tenantId && initial && (
              <Button variant="danger" onClick={remove}>
                Delete tenant
              </Button>
            )}
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {failure && <p className="text-sm text-alarm-text">{failure}</p>}
        <div className="min-h-0 flex-1">
          {initial && (
            <ConfigEditor
              initial={initial}
              isFormReady={isTenantConfig}
              renderForm={(config, onChange) => <TenantForm config={config} onChange={onChange} />}
              validate={(text, signal) => validateTenant(tenantId, text, signal)}
              save={save}
              onSaved={(outcome) => onSaved(outcome.siteId)}
            />
          )}
        </div>
      </div>
    </dialog>
  )
}
