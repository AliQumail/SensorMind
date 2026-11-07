export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const DURATION_MS: Record<ToastKind, number> = { success: 4000, info: 4000, warning: 6000, error: 6000 }
const MAX_VISIBLE = 4

let toasts: Toast[] = []
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getToasts = () => toasts

export function dismissToast(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function show(kind: ToastKind, message: string) {
  // The same message again (a poll failing every few seconds) restarts the timer instead of stacking.
  const existing = toasts.find((t) => t.kind === kind && t.message === message)
  const id = existing?.id ?? nextId++
  clearTimeout(timers.get(id))
  timers.set(id, setTimeout(() => dismissToast(id), DURATION_MS[kind]))
  if (existing) return

  toasts = [...toasts, { id, kind, message }]
  for (const old of toasts.slice(0, -MAX_VISIBLE)) dismissToast(old.id)
  emit()
}

/** Also usable outside React, e.g. from the API client. */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  warning: (message: string) => show('warning', message),
  info: (message: string) => show('info', message),
}

export const useToast = () => toast
