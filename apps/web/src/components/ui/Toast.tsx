import { useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  text: string
}

export const MAX_VISIBLE_TOASTS = 4

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS)

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

const DEFAULT_DURATION_MS = 4500

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const remainingRef = useRef<number>(DEFAULT_DURATION_MS)
  const startedAtRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onDismissRef.current(toast.id)
    }, Math.max(0, remainingRef.current))
  }

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      const elapsed = Date.now() - startedAtRef.current
      remainingRef.current = Math.max(400, remainingRef.current - elapsed)
    }
  }

  useEffect(() => {
    remainingRef.current = DEFAULT_DURATION_MS
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onDismissRef.current(toast.id)
    }, DEFAULT_DURATION_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id])

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />,
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-100',
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />,
          bg: 'bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-100',
        }
      default:
        return {
          icon: <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-white border-slate-200 text-slate-900 dark:bg-slate-900/95 dark:border-slate-700 dark:text-slate-100',
        }
    }
  }

  const { icon, bg } = getStyles()

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
      className={`pointer-events-auto animate-toast-in flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-xs font-medium shadow-lg backdrop-blur-md ${bg}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="break-words">{toast.text}</span>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
