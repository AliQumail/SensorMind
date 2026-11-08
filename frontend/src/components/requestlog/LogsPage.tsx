import { useEffect, useState, type ReactNode } from 'react'
import { fetchLogs } from '../../api/client'
import type { LogRow, LogsPage as LogsData } from '../../api/types'
import { appHref } from '../../lib/logsRoute'

const RANGES = [
  { id: '15m', label: 'Last 15 min', minutes: 15 },
  { id: '1h', label: 'Last hour', minutes: 60 },
  { id: '24h', label: 'Last 24 hours', minutes: 1440 },
]

interface Filters {
  type: string
  statusClass: string
  statusCode: string
  method: string
  path: string
  user: string
  message: string
  /** A preset window ending now, or '' for the From/To fields. */
  range: string
  /** UTC date-times as typed in a datetime-local input. */
  from: string
  to: string
  pageSize: number
  page: number
}

const EMPTY: Filters = {
  type: '',
  statusClass: '',
  statusCode: '',
  method: '',
  path: '',
  user: '',
  message: '',
  range: '',
  from: '',
  to: '',
  pageSize: 50,
  page: 1,
}

const TEXT_KEYS = ['type', 'statusClass', 'statusCode', 'method', 'path', 'user', 'message', 'range', 'from', 'to'] as const
const PAGE_SIZES = [25, 50, 100]
const DEBOUNCE_MS = 350
const AUTO_REFRESH_MS = 10_000

function readUrl(): Filters {
  const q = new URLSearchParams(window.location.search)
  const filters = { ...EMPTY }
  for (const key of TEXT_KEYS) filters[key] = q.get(key) ?? ''
  const size = Number(q.get('pageSize'))
  if (PAGE_SIZES.includes(size)) filters.pageSize = size
  filters.page = Math.max(1, Math.floor(Number(q.get('page'))) || 1)
  return filters
}

function writeUrl(filters: Filters) {
  const q = new URLSearchParams()
  for (const key of TEXT_KEYS) if (filters[key]) q.set(key, filters[key])
  if (filters.pageSize !== EMPTY.pageSize) q.set('pageSize', String(filters.pageSize))
  if (filters.page > 1) q.set('page', String(filters.page))
  const search = q.size ? `?${q}` : ''
  window.history.replaceState(null, '', `${window.location.pathname}${search}`)
}

/** The API query for the filters. A datetime-local value has no zone, so it is read as UTC. */
function toParams(f: Filters): URLSearchParams {
  const q = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) })
  const set = (key: string, value: string) => value.trim() && q.set(key, value.trim())
  set('type', f.type)
  set('statusClass', f.statusClass)
  set('statusCode', f.statusCode)
  set('method', f.method)
  set('path', f.path)
  set('user', f.user)
  set('message', f.message)
  const range = RANGES.find((r) => r.id === f.range)
  if (range) {
    q.set('from', new Date(Date.now() - range.minutes * 60_000).toISOString())
  } else {
    if (f.from) q.set('from', `${f.from}:00Z`)
    if (f.to) q.set('to', `${f.to}:59.999Z`)
  }
  return q
}

const STATUS_TEXT: Record<number, string> = { 2: 'text-normal-text', 3: 'text-text-muted', 4: 'text-warning-text', 5: 'text-alarm-text' }

const fieldClass =
  'w-full rounded-lg border border-border-strong bg-surface-raised px-2.5 py-1.5 text-sm text-text focus:border-accent focus:outline-none'

const buttonClass = 'rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-medium text-text-muted">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Long text is cut to one line; click (or Enter) to read all of it. */
function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return <span className="text-text-muted">-</span>
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      title={text}
      className={`block max-w-[22rem] text-left ${open ? 'break-words whitespace-normal' : 'truncate'}`}
    >
      {text}
    </button>
  )
}

function Row({ row }: { row: LogRow }) {
  const failure = row.type === 'FAILURE'
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.timestampUtc.slice(0, 19).replace('T', ' ')}</td>
      <td className="px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            failure ? 'bg-alarm/15 text-alarm-text' : 'bg-normal/15 text-normal-text'
          }`}
        >
          {row.type}
        </span>
      </td>
      <td className={`px-3 py-2 font-mono text-xs font-semibold ${STATUS_TEXT[Math.floor(row.statusCode / 100)] ?? ''}`}>{row.statusCode}</td>
      <td className="px-3 py-2 font-mono text-xs">{row.method}</td>
      <td className="px-3 py-2 font-mono text-xs">
        <Expandable text={row.path} />
      </td>
      <td className="px-3 py-2">{row.loggedInUser || <span className="text-text-muted">-</span>}</td>
      <td className="px-3 py-2">
        <Expandable text={row.errorMessage ?? ''} />
      </td>
    </tr>
  )
}

const COLUMNS = ['Time (UTC)', 'Type', 'Status', 'Method', 'Path', 'User', 'Error message']

export function LogsPage() {
  const [form, setForm] = useState(readUrl)
  const [applied, setApplied] = useState(form)
  const [data, setData] = useState<LogsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [auto, setAuto] = useState(false)

  const update = (patch: Partial<Filters>) => setForm((f) => ({ ...f, page: 1, ...patch }))

  // Typing waits for a pause before the table reloads.
  useEffect(() => {
    const timer = setTimeout(() => setApplied(form), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [form])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => setTick((t) => t + 1), AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [auto])

  useEffect(() => {
    writeUrl(applied)
    const controller = new AbortController()
    setLoading(true)
    fetchLogs(toParams(applied), controller.signal)
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch(() => {
        // The API client has shown a toast; an aborted request is superseded by a newer one.
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [applied, tick])

  const total = data?.total ?? 0
  const first = total === 0 ? 0 : (applied.page - 1) * applied.pageSize + 1
  const last = Math.min(total, applied.page * applied.pageSize)
  const pages = Math.max(1, Math.ceil(total / applied.pageSize))
  const filtered = JSON.stringify({ ...form, page: 1, pageSize: 50 }) !== JSON.stringify(EMPTY)
  const noRange = form.range === '' && form.from === '' && form.to === ''

  return (
    <div className="mx-auto flex min-h-full max-w-[96rem] flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
          <div>
            <h1 className="text-lg leading-tight font-semibold">Request logs</h1>
            <p className="text-xs text-text-muted">Public and read-only. Failed requests and successful writes, newest first.</p>
          </div>
        </div>
        <a href={appHref} className="text-sm font-medium text-accent-text hover:underline">
          Back to SensorMind
        </a>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(form)
        }}
        aria-label="Log filters"
        className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-surface p-3 shadow-soft"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Type">
            <select value={form.type} onChange={(e) => update({ type: e.target.value })} className={fieldClass}>
              <option value="">All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
          </Field>
          <Field label="Status class">
            <select value={form.statusClass} onChange={(e) => update({ statusClass: e.target.value })} className={fieldClass}>
              <option value="">All</option>
              {['2xx', '3xx', '4xx', '5xx'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status code">
            <input
              type="number"
              min={100}
              max={599}
              inputMode="numeric"
              placeholder="e.g. 401"
              value={form.statusCode}
              onChange={(e) => update({ statusCode: e.target.value })}
              className={`${fieldClass} font-mono`}
            />
          </Field>
          <Field label="Method">
            <select value={form.method} onChange={(e) => update({ method: e.target.value })} className={fieldClass}>
              <option value="">All</option>
              {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Path contains">
            <input value={form.path} onChange={(e) => update({ path: e.target.value })} className={`${fieldClass} font-mono`} />
          </Field>
          <Field label="User contains">
            <input value={form.user} onChange={(e) => update({ user: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Message contains">
            <input value={form.message} onChange={(e) => update({ message: e.target.value })} className={fieldClass} />
          </Field>
          <Field label="Page size">
            <select value={form.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} className={fieldClass}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="From (UTC)">
            <input
              type="datetime-local"
              value={form.from}
              onChange={(e) => update({ from: e.target.value, range: '' })}
              className={fieldClass}
            />
          </Field>
          <Field label="To (UTC)">
            <input
              type="datetime-local"
              value={form.to}
              onChange={(e) => update({ to: e.target.value, range: '' })}
              className={fieldClass}
            />
          </Field>
          <div role="group" aria-label="Time range" className="flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={form.range === r.id}
                onClick={() => update({ range: r.id, from: '', to: '' })}
                className={`${buttonClass} ${form.range === r.id ? 'border-accent! bg-accent-soft! font-medium text-accent-text' : ''}`}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={noRange}
              onClick={() => update({ range: '', from: '', to: '' })}
              className={`${buttonClass} ${noRange ? 'border-accent! bg-accent-soft! font-medium text-accent-text' : ''}`}
            >
              All
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-accent-hover" />
              Auto-refresh (10 s)
            </label>
            <button
              type="button"
              onClick={() => setTick((t) => t + 1)}
              className="rounded-lg bg-accent-hover px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-active"
            >
              Refresh
            </button>
            <button type="button" disabled={!filtered} onClick={() => setForm({ ...EMPTY, pageSize: form.pageSize })} className={buttonClass}>
              Clear filters
            </button>
          </div>
        </div>
      </form>

      <section aria-label="Log entries" className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-soft">
        {!data ? (
          <div role="status" className="grid place-items-center p-10 text-sm text-text-muted">
            {loading ? 'Loading log entries…' : 'Could not load the log entries.'}
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <caption className="sr-only">Request log entries, newest first</caption>
              <thead className="bg-surface-hover text-xs text-text-muted">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <Row key={row.id} row={row} />
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && <p className="p-8 text-center text-sm text-text-muted">No log entries match these filters</p>}
          </div>
        )}
      </section>

      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p role="status" aria-live="polite" className="text-text-muted">
          Showing {first}-{last} of {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={applied.page <= 1}
            onClick={() => setForm((f) => ({ ...f, page: applied.page - 1 }))}
            className={buttonClass}
          >
            Previous
          </button>
          <span className="text-text-muted">
            Page {applied.page} of {pages}
          </span>
          <button
            type="button"
            disabled={applied.page >= pages}
            onClick={() => setForm((f) => ({ ...f, page: applied.page + 1 }))}
            className={buttonClass}
          >
            Next
          </button>
        </div>
      </nav>
    </div>
  )
}
