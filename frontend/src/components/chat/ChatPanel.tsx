import { usePlant } from '../../state/plantContext'

/** Placeholder until the RAG pipeline lands in Phase 2. Layout and context chip are final. */
export function ChatPanel() {
  const { index, selection } = usePlant()
  const selected = selection?.kind === 'equipment' ? index.equipmentById.get(selection.id)?.equipment : undefined

  return (
    <section aria-label="Assistant" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Ask SensorMind</h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">Coming in Phase 2</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-6 text-center text-sm text-text-muted">
        <p>Ask about plant state, recent readings and equipment manuals.</p>
        <p>Answers will cite manual pages and can include inline trend charts.</p>
      </div>
      <form className="border-t border-border p-3" onSubmit={(e) => e.preventDefault()}>
        {selected && (
          <p className="mb-2 text-xs text-text-muted">
            Context: <span className="font-medium text-text">{selected.name}</span>
          </p>
        )}
        <div className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Question
          </label>
          <input
            id="chat-input"
            disabled
            placeholder="e.g. Why is P-101 bearing temperature rising?"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm placeholder:text-text-muted disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled
            className="rounded-lg bg-accent-hover px-3 py-2 text-sm font-medium text-white hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ask
          </button>
        </div>
      </form>
    </section>
  )
}
