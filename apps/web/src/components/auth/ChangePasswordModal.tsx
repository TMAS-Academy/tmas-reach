import { useState } from 'react'
import { changePassword } from '../../lib/authSession'
import type { ApiClient } from '../../lib/apiClient'
import { ModalShell } from '../ui/ModalShell'
import { AlertCircle } from 'lucide-react'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  client?: ApiClient
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword, client)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      subtitle="Update the password for your signed-in account."
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="changePasswordForm"
            disabled={saving}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </>
      }
    >
      <form id="changePasswordForm" onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="current-password"
            className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Current Password *
          </label>
          <input
            id="current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            New Password *
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="confirm-new-password"
            className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Confirm New Password *
          </label>
          <input
            id="confirm-new-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </form>
    </ModalShell>
  )
}
