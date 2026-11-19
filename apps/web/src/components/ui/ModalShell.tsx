import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const openDialogStack: string[] = []
let scrollLockCount = 0
let previousOverflow = ''

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (scrollLockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount++
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousOverflow
  }
}

export interface ModalShellProps {
  isOpen?: boolean
  onClose: () => void
  title: string
  subtitle?: string
  titleBadge?: ReactNode
  variant?: 'modal' | 'drawer'
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  closeOnBackdrop?: boolean
  footer?: ReactNode
  bodyClassName?: string
  children: ReactNode
}

const MODAL_SIZE_CLASS: Record<NonNullable<ModalShellProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
}

const DRAWER_SIZE_CLASS: Record<NonNullable<ModalShellProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function ModalShell({
  isOpen = true,
  onClose,
  title,
  subtitle,
  titleBadge,
  variant = 'modal',
  size = 'md',
  closeOnBackdrop = true,
  footer,
  bodyClassName,
  children,
}: ModalShellProps) {
  const titleId = useId()
  const dialogId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    openDialogStack.push(dialogId)
    lockBodyScroll()

    const panel = panelRef.current
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable && !panel.contains(document.activeElement)) {
        focusable.focus()
      } else if (!panel.contains(document.activeElement)) {
        panel.focus()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openDialogStack[openDialogStack.length - 1] === dialogId) {
        event.stopPropagation()
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      const idx = openDialogStack.lastIndexOf(dialogId)
      if (idx !== -1) {
        openDialogStack.splice(idx, 1)
      }
      unlockBodyScroll()
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [isOpen, dialogId])

  if (!isOpen) return null

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        isDrawer ? 'justify-end' : 'items-center justify-center p-4'
      } bg-slate-950/65 backdrop-blur-sm animate-backdrop-in`}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          isDrawer
            ? `flex h-full w-full ${DRAWER_SIZE_CLASS[size]} flex-col bg-white shadow-2xl border-l border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 animate-drawer-in focus:outline-none`
            : `flex max-h-[92vh] w-full ${MODAL_SIZE_CLASS[size]} flex-col rounded-xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 animate-modal-in focus:outline-none`
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={titleId}
                className="text-lg font-semibold text-slate-900 dark:text-white truncate"
              >
                {title}
              </h3>
              {titleBadge}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={bodyClassName ?? 'flex-1 overflow-y-auto px-6 py-5'}>{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
