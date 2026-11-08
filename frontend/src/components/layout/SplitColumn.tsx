import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Panel } from './Panel'

export interface SplitSection {
  /** Shown in the header bar, next to the chevron. */
  title: ReactNode
  children: ReactNode
}

const HEADER = 40 // px, a collapsed section
const MIN_OPEN = 140 // px, an open section: header plus a little content
const HANDLE = 12 // px, the gap between the sections
const DEFAULT_RATIO = 0.6
const KEY_STEP = 0.05

interface Saved {
  ratio: number
  collapsed: [boolean, boolean]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function load(key: string): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (saved && typeof saved.ratio === 'number' && Array.isArray(saved.collapsed)) {
      return { ratio: clamp(saved.ratio, 0, 1), collapsed: [saved.collapsed[0] === true, saved.collapsed[1] === true] }
    }
  } catch {
    // Storage unavailable or corrupt: use the defaults.
  }
  return { ratio: DEFAULT_RATIO, collapsed: [false, false] }
}

/** Two stacked sections with collapsible headers and a draggable splitter. The layout and keyboard model follow VS Code panels. */
export function SplitColumn({ sections, storageKey, className = '' }: { sections: [SplitSection, SplitSection]; storageKey: string; className?: string }) {
  const key = `sensormind.split.${storageKey}`
  const [state, setState] = useState(() => load(key))
  const [dragging, setDragging] = useState(false)
  const [height, setHeight] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const ids = [useId(), useId()]

  useEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (dragging) return
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Storage unavailable: the layout still works for this visit.
    }
  }, [key, state, dragging])

  const avail = Math.max(height - HANDLE, 1)
  const minShare = Math.min(MIN_OPEN / avail, 0.5)
  const ratio = clamp(state.ratio, minShare, 1 - minShare)
  const [topCollapsed, bottomCollapsed] = state.collapsed
  const split = !topCollapsed && !bottomCollapsed

  const setRatio = (next: number) => setState((s) => ({ ...s, ratio: clamp(next, minShare, 1 - minShare) }))
  const toggle = (i: 0 | 1) =>
    setState((s) => ({ ...s, collapsed: i === 0 ? [!s.collapsed[0], s.collapsed[1]] : [s.collapsed[0], !s.collapsed[1]] }))

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault() // no text selection while dragging
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !root.current) return
    const rect = root.current.getBoundingClientRect()
    setRatio((e.clientY - rect.top - HANDLE / 2) / avail)
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowUp: ratio - KEY_STEP, ArrowDown: ratio + KEY_STEP, Home: 0, End: 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    setRatio(next)
  }

  // Flex-grow carries the split; a collapsed section shrinks to its header and the open one takes the rest.
  const section = (i: 0 | 1) => {
    const collapsed = state.collapsed[i]
    const grow = collapsed ? 0 : split ? (i === 0 ? ratio : 1 - ratio) : 1
    return (
      <Panel
        className={`flex flex-col ${dragging ? '' : 'motion-safe:transition-[flex-grow,min-height] motion-safe:duration-150'}`}
        style={{ flex: `${grow} 1 0`, minHeight: collapsed ? HEADER : MIN_OPEN }}
      >
        <h2 className="shrink-0">
          <button
            type="button"
            onClick={() => toggle(i)}
            aria-expanded={!collapsed}
            aria-controls={ids[i]}
            className={`flex w-full items-center gap-2 px-4 text-left font-semibold hover:bg-surface-hover ${collapsed ? '' : 'border-b border-border'}`}
            style={{ height: HEADER }}
          >
            <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-text-muted motion-safe:transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden>
              <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">{sections[i].title}</span>
          </button>
        </h2>
        {/* Stays mounted when collapsed, so chat history and scroll positions survive. */}
        <div id={ids[i]} inert={collapsed} className="min-h-0 flex-1">
          {sections[i].children}
        </div>
      </Panel>
    )
  }

  return (
    <div ref={root} className={`flex flex-col ${dragging ? 'select-none' : ''} ${className}`}>
      {section(0)}
      {split ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize sections"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={Math.round(minShare * 100)}
          aria-valuemax={Math.round((1 - minShare) * 100)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setRatio(DEFAULT_RATIO)}
          onKeyDown={onKeyDown}
          className="group relative shrink-0 cursor-row-resize touch-none outline-none"
          style={{ height: HANDLE }}
        >
          <div
            className={`absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 group-hover:bg-accent group-focus-visible:bg-accent ${dragging ? 'bg-accent' : ''}`}
          />
        </div>
      ) : (
        <div className="shrink-0" style={{ height: HANDLE }} />
      )}
      {section(1)}
    </div>
  )
}
