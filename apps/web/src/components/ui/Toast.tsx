import { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  text: string
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />,
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-200',
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />,
          bg: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/70 dark:border-rose-800 dark:text-rose-200',
        }
      default:
        return {
          icon: <Info className="h-4 w-4 text-indigo-600 shrink-0" />,
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/70 dark:border-indigo-800 dark:text-indigo-200',
        }
    }
  }

  const { icon, bg } = getStyles()

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 shadow-lg text-xs font-medium transition-all ${bg}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{toast.text}</span>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded p-0.5 opacity-70 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
