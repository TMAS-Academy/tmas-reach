import { useState, useRef, useMemo } from 'react'
import type { User, UserRole } from '../../types'
import { store } from '../../lib/store'
import {
  parseTeamCsvContent,
  getSampleTeamCsv,
  type TeamCsvAnalysis,
} from '../../lib/teamCsvParser'
import { formatRoleLabel } from '../../lib/rbac'
import { ModalShell } from '../ui/ModalShell'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { ToastType } from '../ui/Toast'
import {
  Shield,
  Upload,
  UserPlus,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react'

interface UserManagementProps {
  users: User[]
  currentUserId?: string
  onToast?: (type: ToastType, text: string) => void
}

export function UserManagement({ users, currentUserId, onToast }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('marketing_intern')
  const [newPassword, setNewPassword] = useState('')
  const [savingMember, setSavingMember] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<
    Array<{ email: string; role: UserRole; temporary_password: string }>
  >([])

  const [csvRawText, setCsvRawText] = useState('')
  const [csvAnalysis, setCsvAnalysis] = useState<TeamCsvAnalysis | null>(null)
  const [importingCsv, setImportingCsv] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isApiMode = store.isApiMode()

  const adminCount = useMemo(
    () => users.filter((u) => u.role === 'administrator').length,
    [users]
  )

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        formatRoleLabel(u.role).toLowerCase().includes(q)
    )
  }, [users, searchTerm])

  const handleRoleChange = (user: User, newRoleVal: UserRole) => {
    const res = store.updateUserRole(user.id, newRoleVal)
    if (!res.success) {
      onToast?.('error', res.error || 'Unable to update role.')
      return
    }
    onToast?.('info', `Updated ${user.full_name}'s role to ${formatRoleLabel(newRoleVal)}.`)
  }

  const handleRequestDeleteUser = (user: User) => {
    if (user.role === 'administrator' && adminCount <= 1) {
      onToast?.('error', 'Cannot remove the last administrator account.')
      return
    }
    setDeleteTarget(user)
  }

  const handleConfirmDeleteUser = () => {
    if (!deleteTarget) return
    const res = store.deleteUser(deleteTarget.id)
    if (res.success) {
      onToast?.('info', `Removed ${deleteTarget.full_name}.`)
    } else {
      onToast?.('error', res.error || 'Failed to remove user.')
    }
    setDeleteTarget(null)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)

    if (!newEmail.trim()) {
      setAddError('Email address is required.')
      return
    }

    if (isApiMode && newPassword && newPassword.length < 8) {
      setAddError('Initial password must be at least 8 characters long.')
      return
    }

    if (!isApiMode) {
      const res = store.addUser({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
      })

      if (!res.success) {
        setAddError(res.error || 'Failed to add user.')
        return
      }

      onToast?.('success', `Added ${res.user?.full_name}.`)
      setNewEmail('')
      setNewName('')
      setNewRole('marketing_intern')
      setIsAddModalOpen(false)
      return
    }

    setSavingMember(true)
    try {
      const res = await store.addUserAsync({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
        ...(newPassword ? { password: newPassword } : {}),
      })

      if (!res.success) {
        setAddError(res.error || 'Failed to add user.')
        return
      }

      if (res.temporaryPassword) {
        setCreatedCredentials((prev) => [
          {
            email: res.user?.email || newEmail.trim(),
            role: res.user?.role || newRole,
            temporary_password: res.temporaryPassword!,
          },
          ...prev,
        ])
      }

      onToast?.('success', `Added ${res.user?.full_name || newEmail.trim()}.`)
      setNewEmail('')
      setNewName('')
      setNewPassword('')
      setNewRole('marketing_intern')
      setIsAddModalOpen(false)
    } finally {
      setSavingMember(false)
    }
  }

  const handleCsvTextChange = (text: string) => {
    setCsvRawText(text)
    if (text.trim()) {
      setCsvAnalysis(parseTeamCsvContent(text))
    } else {
      setCsvAnalysis(null)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = String(event.target?.result || '')
      handleCsvTextChange(content)
    }
    reader.readAsText(file)
  }

  const handleDownloadSample = () => {
    const sample = getSampleTeamCsv()
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'team-roster-sample.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExecuteCsvImport = async () => {
    if (!csvAnalysis || csvAnalysis.validRows.length === 0) return

    if (!isApiMode) {
      const result = store.importUsers(csvAnalysis.validRows)
      onToast?.('success', `Import complete: ${result.imported} created, ${result.updated} updated.`)
      setIsCsvModalOpen(false)
      setCsvRawText('')
      setCsvAnalysis(null)
      return
    }

    setImportingCsv(true)
    try {
      const result = await store.importUsersAsync(csvAnalysis.validRows)
      if (result.error) {
        onToast?.('error', result.error)
        return
      }
      if (result.createdCredentials && result.createdCredentials.length > 0) {
        setCreatedCredentials((prev) => [
          ...result.createdCredentials!.map((c) => ({
            email: c.email,
            role: c.role,
            temporary_password: c.temporary_password,
          })),
          ...prev,
        ])
      }
      onToast?.('success', `Import complete: ${result.imported} created, ${result.updated} updated.`)
      setIsCsvModalOpen(false)
      setCsvRawText('')
      setCsvAnalysis(null)
    } finally {
      setImportingCsv(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Team & Role Management
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Manage authorized team members and roles across any email domain.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            title="Download CSV template"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>CSV Template</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>Import Team CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {createdCredentials.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">
              One-Time Temporary Passwords (share securely with new team members)
            </div>
            <button
              type="button"
              onClick={() => setCreatedCredentials([])}
              className="rounded px-2 py-0.5 text-[11px] font-medium hover:bg-amber-200/70 dark:hover:bg-amber-900/60"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            {createdCredentials.map((cred) => (
              <div key={cred.email} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{cred.email}</span>
                <span className="text-slate-600 dark:text-slate-400">({formatRoleLabel(cred.role)})</span>
                <span>→</span>
                <code className="rounded bg-white px-2 py-0.5 text-slate-900 dark:bg-slate-900 dark:text-amber-300">
                  {cred.temporary_password}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search team members by name, email, or role..."
          aria-label="Search team members"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No team members match "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId
                  const isSoleAdmin = user.role === 'administrator' && adminCount <= 1
                  return (
                    <tr
                      key={user.id}
                      className={
                        isCurrentUser
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span>{user.full_name}</span>
                          {isCurrentUser && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                          <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          {formatRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            aria-label={`Change role for ${user.full_name}`}
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="marketing_intern">Marketing Intern</option>
                            <option value="marketing_lead">Marketing Lead</option>
                            <option value="administrator">Administrator</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRequestDeleteUser(user)}
                            disabled={isSoleAdmin}
                            aria-label={`Remove ${user.full_name}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            title={
                              isSoleAdmin
                                ? 'Cannot remove the last administrator'
                                : 'Remove member'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setAddError(null)
        }}
        title="Add Team Member"
        subtitle="Grant workspace access to a team member with any email address."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addUserForm"
              disabled={savingMember}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
            >
              {savingMember ? 'Saving...' : 'Save Member'}
            </button>
          </>
        }
      >
        <form id="addUserForm" onSubmit={handleAddSubmit} className="space-y-3.5">
          {addError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="new-member-email"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Email Address *
            </label>
            <input
              id="new-member-email"
              type="email"
              required
              placeholder="name@gmail.com, student@university.edu"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="new-member-name"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Full Name
            </label>
            <input
              id="new-member-name"
              type="text"
              placeholder="First Last"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="new-member-role"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Role
            </label>
            <select
              id="new-member-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className={inputClass}
            >
              <option value="marketing_intern">Marketing Intern (Drafts & submits)</option>
              <option value="marketing_lead">Marketing Lead (Approves & sends)</option>
              <option value="administrator">Administrator (Full control)</option>
            </select>
          </div>

          {isApiMode && (
            <div>
              <label
                htmlFor="new-member-password"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Initial Password (optional)
              </label>
              <input
                id="new-member-password"
                type="password"
                placeholder="Leave blank to generate a temporary password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </form>
      </ModalShell>

      <ModalShell
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Import Team Roster from CSV"
        subtitle="Upload or paste email,name,role rows to bulk add or update team members."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!csvAnalysis || csvAnalysis.validRows.length === 0 || importingCsv}
              onClick={() => void handleExecuteCsvImport()}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importingCsv
                ? 'Importing...'
                : `Import ${csvAnalysis?.validRows.length || 0} Members`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Columns:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              email,name,role
            </code>
            . Any valid email domain is accepted.
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Select .csv File
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              or paste CSV text below
            </span>
          </div>

          <textarea
            rows={4}
            value={csvRawText}
            onChange={(e) => handleCsvTextChange(e.target.value)}
            placeholder="email,name,role&#10;sarah.lead@gmail.com,Sarah Jenkins,marketing_lead&#10;alex@stanford.edu,Alex Rivera,marketing_intern"
            className={`${inputClass} font-mono`}
          />

          {csvAnalysis && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {csvAnalysis.validRows.length} valid rows
                </span>
                {csvAnalysis.skippedDuplicates.length > 0 && (
                  <span className="text-slate-500">
                    {csvAnalysis.skippedDuplicates.length} duplicate emails skipped
                  </span>
                )}
                {csvAnalysis.invalidRows.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {csvAnalysis.invalidRows.length} errors
                  </span>
                )}
              </div>

              {csvAnalysis.invalidRows.length > 0 && (
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {csvAnalysis.invalidRows.map((err, idx) => (
                    <div key={idx}>
                      Row {err.rowNumber}: {err.reason}
                    </div>
                  ))}
                </div>
              )}

              {csvAnalysis.validRows.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5">Email</th>
                        <th className="px-3 py-1.5">Name</th>
                        <th className="px-3 py-1.5">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px] dark:divide-slate-800">
                      {csvAnalysis.validRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-slate-900 dark:text-white">{r.email}</td>
                          <td className="px-3 py-1.5 font-sans">{r.full_name}</td>
                          <td className="px-3 py-1.5 text-amber-700 dark:text-amber-400">
                            {formatRoleLabel(r.role)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalShell>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Remove team member?"
        message={`Remove ${deleteTarget?.full_name || ''} (${deleteTarget?.email || ''}) from the workspace?`}
        confirmLabel="Remove member"
        tone="danger"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
