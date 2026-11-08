import type { CSSProperties, ReactNode } from 'react'

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={`min-h-0 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-soft ${className}`}
    >
      {children}
    </div>
  )
}
