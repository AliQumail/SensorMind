import { useEffect, useState, type ReactNode } from 'react'
import type { SaveOutcome } from '../../api/client'
import type { ValidationError } from '../../api/types'
import { Button } from './ui'

type Mode = 'ui' | 'json'

interface Props<T> {
  initial: T
  /** Whether parsed JSON has enough structure for the form view to render it without crashing. */
  isFormReady: (value: unknown) => value is T
  renderForm: (config: T, onChange: (config: T) => void) => ReactNode
  validate: (text: string, signal: AbortSignal) => Promise<ValidationError[]>
  save: (text: string) => Promise<SaveOutcome>
  onSaved: (outcome: SaveOutcome) => void
}

/** One JSON document, editable as forms (UI view) or as raw text (JSON view). Saving always sends the text. */
export function ConfigEditor<T>({ initial, isFormReady, renderForm, validate, save, onSaved }: Props<T>) {
  const [mode, setMode] = useState<Mode>('ui')
  const [config, setConfig] = useState<unknown>(initial)
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2))
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)

  const onConfigChange = (next: T) => {
    setConfig(next)
    setText(JSON.stringify(next, null, 2))
  }

  const onTextChange = (next: string) => {
    setText(next)
    setChecking(true)
    try {
      setConfig(JSON.parse(next))
    } catch {
      setConfig(undefined) // Unparseable text: the UI view stays off until the JSON is fixed.
    }
  }

  // Validate with the same rules the server saves with, so both views show identical errors.
  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    const timer = setTimeout(() => {
      validate(text, controller.signal)
        .then(setErrors)
        .catch(() => undefined)
        .finally(() => !controller.signal.aborted && setChecking(false))
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // `validate` is deliberately not a dependency: only a text change should re-validate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const submit = async () => {
    setSaving(true)
    try {
      const outcome = await save(text)
      if (outcome.ok) onSaved(outcome)
      else setErrors(outcome.errors)
    } catch {
      // The API client showed a toast.
    } finally {
      setSaving(false)
    }
  }

  const formReady = isFormReady(config)
  const showForm = mode === 'ui' && formReady

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-lg border border-border bg-surface-raised p-0.5 text-sm">
          {(['ui', 'json'] as const).map((tab) => {
            const active = tab === 'ui' ? showForm : !showForm
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={tab === 'ui' && !formReady}
                onClick={() => setMode(tab)}
                className={`rounded-md px-3 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? 'bg-accent-soft text-accent-text' : 'text-text-muted hover:text-text'
                }`}
              >
                {tab === 'ui' ? 'UI view' : 'JSON view'}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted" aria-live="polite">
            {checking ? 'Checking…' : errors.length === 0 ? 'Valid' : `${errors.length} error${errors.length === 1 ? '' : 's'}`}
          </span>
          <Button variant="primary" disabled={saving || checking || errors.length > 0} onClick={submit}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {!formReady && <p className="text-xs text-text-muted">The UI view is unavailable until this JSON has the expected structure.</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showForm ? (
          renderForm(config, onConfigChange)
        ) : (
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            spellCheck={false}
            aria-label="Config JSON"
            className="h-full min-h-96 w-full resize-none rounded-lg border border-border bg-surface-raised p-3 font-mono text-xs text-text"
          />
        )}
      </div>

      {errors.length > 0 && (
        <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-raised p-2 text-xs text-alarm-text">
          {errors.map((error, i) => (
            <li key={i}>
              <span className="font-mono">{error.path}</span>: {error.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
