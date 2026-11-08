import { useEffect, useRef, useState, type FormEvent } from 'react'
import Markdown from 'react-markdown'
import { askChat, fetchChatStatus, type ChatChartData, type ChatCitation, type ChatStatus } from '../../api/client'
import { usePlant } from '../../state/plantContext'
import { ChatChart } from './ChatChart'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations: ChatCitation[]
  charts: ChatChartData[]
  error?: string
}

/** The assistant writes ```chart blocks for the graphs it asks for; the graphs render separately, so hide the blocks. */
const visibleText = (content: string) => content.replace(/```chart[\s\S]*?(```|$)/g, '').trim()

export function ChatPanel() {
  const { index, selection } = usePlant()
  const selected = selection?.kind === 'asset' ? index.assetById.get(selection.id)?.asset : undefined

  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [ownKey, setOwnKey] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchChatStatus()
      .then((s) => {
        setStatus(s)
        setRemaining(s.remaining)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const updateLast = (change: (m: Message) => Message) =>
    setMessages((current) => current.map((m, i) => (i === current.length - 1 ? change(m) : m)))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = question.trim()
    if (!text || busy) return

    const history = messages.filter((m) => !m.error && m.content).map((m) => ({ role: m.role, content: m.content }))
    setMessages([...messages, { role: 'user', content: text, citations: [], charts: [] }, { role: 'assistant', content: '', citations: [], charts: [] }])
    setQuestion('')
    setBusy(true)
    try {
      await askChat(
        { question: text, assetId: selected?.id, history },
        ownKey.trim() || null,
        {
          onToken: (t) => updateLast((m) => ({ ...m, content: m.content + t })),
          onCitations: (citations) => updateLast((m) => ({ ...m, citations })),
          onChart: (chart) => updateLast((m) => ({ ...m, charts: [...m.charts, chart] })),
          onDone: (left) => {
            if (left !== null) setRemaining(left)
          },
        },
        new AbortController().signal,
      )
    } catch (e) {
      updateLast((m) => ({ ...m, error: e instanceof Error ? e.message : String(e) }))
      // A rate-limit reply means nothing is left, whatever the last known count was.
      if (e instanceof Error && 'status' in e && e.status === 429) setRemaining(0)
    } finally {
      setBusy(false)
    }
  }

  const unconfigured = status !== null && !status.configured && !ownKey.trim()

  return (
    <section aria-label="Assistant" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2 pt-6 text-center text-text-muted">
            <p>Ask about plant state, recent readings and manuals.</p>
            <p>Answers cite manual pages and can include trend charts.</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-soft px-3 py-2 text-accent-text">
              {m.content}
            </p>
          ) : (
            <div key={i} className="max-w-full">
              {visibleText(m.content) ? (
                <div className="[&_a]:underline [&_code]:rounded [&_code]:bg-surface-hover [&_code]:px-1 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
                  <Markdown>{visibleText(m.content)}</Markdown>
                </div>
              ) : (
                !m.error &&
                !m.charts.length && <p className="text-text-muted">{busy && i === messages.length - 1 ? 'Thinking…' : ''}</p>
              )}
              {m.charts.map((chart) => (
                <ChatChart key={chart.tagId} chart={chart} />
              ))}
              {m.citations.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
                  {m.citations.map((c) => (
                    <li key={`${c.source}:${c.page}`} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text">
                      {c.source} · p.{c.page}
                    </li>
                  ))}
                </ul>
              )}
              {m.error && (
                <p role="alert" className="mt-1 text-alarm-text">
                  {m.error}
                </p>
              )}
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      <form className="border-t border-border p-3" onSubmit={submit}>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-text-muted">
          <p>
            {selected && (
              <>
                Context: <span className="font-medium text-text">{selected.name}</span>
              </>
            )}
          </p>
          {remaining !== null && !ownKey.trim() && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-text">
              {remaining} of {status?.limit ?? 10} free left today
            </span>
          )}
        </div>
        {unconfigured && <p className="mb-2 text-xs text-alarm-text">Chat isn&apos;t configured yet. Use your own OpenRouter key below.</p>}
        <div className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Question
          </label>
          <input
            id="chat-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder="e.g. Why is cabinet R-03 getting warmer?"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={busy || !question.trim() || unconfigured}
            className="rounded-lg bg-accent-hover px-3 py-2 text-sm font-medium text-white hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Asking…' : 'Ask'}
          </button>
        </div>
        <details className="mt-2 text-xs text-text-muted">
          <summary className="cursor-pointer">Use my own OpenRouter key</summary>
          <input
            type="password"
            value={ownKey}
            onChange={(e) => setOwnKey(e.target.value)}
            autoComplete="off"
            aria-label="OpenRouter API key"
            placeholder="sk-or-... (kept in this tab only, for unlimited questions)"
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm placeholder:text-text-muted"
          />
        </details>
      </form>
    </section>
  )
}
