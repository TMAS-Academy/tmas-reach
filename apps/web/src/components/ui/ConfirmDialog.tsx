import { AlertTriangle, HelpCircle } from 'lucide-react'
import { ModalShell } from './ModalShell'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const iconStyles =
    tone === 'danger'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'

  const confirmStyles =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400/70'
      : 'bg-amber-400 text-slate-950 hover:bg-amber-300 focus-visible:ring-amber-400/70'

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 transition-colors ${confirmStyles}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles}`}>
          {tone === 'default' ? (
            <HelpCircle className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </ModalShell>
  )
}
