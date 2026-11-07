import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { dismissToast, getToasts, subscribeToasts, type ToastKind } from '../../state/toastStore'

const STYLE: Record<ToastKind, { bar: string; text: string; icon: string }> = {
  success: { bar: 'bg-normal', text: 'text-normal-text', icon: 'M3.5 8.5l3 3 6-6.5' },
  error: { bar: 'bg-alarm', text: 'text-alarm-text', icon: 'M4.5 4.5l7 7M11.5 4.5l-7 7' },
  warning: { bar: 'bg-warning', text: 'text-warning-text', icon: 'M8 4v4.5M8 11.5v.01' },
  info: { bar: 'bg-accent', text: 'text-accent-text', icon: 'M8 7.5v4M8 4.5v.01' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts)
  const viewport = useRef<HTMLDivElement>(null)

  // A popover sits in the top layer; showing it again lifts it above a modal dialog that opened later.
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    if (element.matches(':popover-open')) element.hidePopover()
    if (toasts.length > 0) element.showPopover()
  }, [toasts])

  return (
    <>
      {children}
      <div
        ref={viewport}
        popover="manual"
        className="fixed inset-auto top-3 right-3 m-0 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-visible border-0 bg-transparent p-0"
      >
        {toasts.map((t) => {
          const style = STYLE[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
              className="flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface-raised py-3 pr-2 pl-0 text-sm text-text shadow-soft motion-safe:animate-[toast-in_180ms_ease-out]"
            >
              <span aria-hidden className={`-my-3 w-1 self-stretch ${style.bar}`} />
              <svg viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${style.text}`} aria-hidden>
                <path d={style.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="min-w-0 flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
                className="grid size-6 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
