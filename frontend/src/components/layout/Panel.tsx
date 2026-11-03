import type { ReactNode } from 'react'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-0 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-soft ${className}`}
    >
      {children}
    </div>
  )
}
