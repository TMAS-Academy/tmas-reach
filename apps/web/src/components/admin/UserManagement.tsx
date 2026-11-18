import { useState, useRef } from 'react'
import type { User, UserRole } from '../../types'
import { store } from '../../lib/store'
import { parseTeamCsvContent, getSampleTeamCsv, type TeamCsvAnalysis } from '../../lib/teamCsvParser'
import { formatRoleLabel } from '../../lib/rbac'
import {
  Shield,
  Upload,
  UserPlus,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface UserManagementProps {
  users: User[]
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void
}

export function UserManagement({ users, onToast }: UserManagementProps) {
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Add Member State
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('marketing_intern')
  const [addError, setAddError] = useState<string | null>(null)

  // CSV Import State
  const [csvRawText, setCsvRawText] = useState('')
  const [csvAnalysis, setCsvAnalysis] = useState<TeamCsvAnalysis | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleRoleChange = (userId: string, newRoleVal: UserRole) => {
    store.updateUserRole(userId, newRoleVal)
    onToast?.('info', `Updated role to ${formatRoleLabel(newRoleVal)}`)
  }

  const handleDeleteUser = (user: User) => {
    if (user.role === 'administrator') {
      const adminCount = users.filter((u) => u.role === 'administrator').length
      if (adminCount <= 1) {
        onToast?.('error', 'Cannot remove the last administrator account.')
        return
      }
    }

    if (!window.confirm(`Remove team member "${user.full_name}" (${user.email})?`)) {
      return
    }

    const res = store.deleteUser(user.id)
    if (res.success) {
      onToast?.('info', `Removed ${user.full_name}`)
    } else {
      onToast?.('error', res.error || 'Failed to remove user.')
    }
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)

    if (!newEmail.trim()) {
      setAddError('Email address is required.')
      return
    }

    const res = store.addUser({
      email: newEmail.trim(),
      full_name: newName.trim(),
      role: newRole,
    })

    if (!res.success) {
      setAddError(res.error || 'Failed to add user.')
      return
    }

    onToast?.('success', `Added ${res.user?.full_name}`)
    setNewEmail('')
    setNewName('')
    setNewRole('marketing_intern')
    setIsAddModalOpen(false)
  }

  const handleCsvTextChange = (text: string) => {
    setCsvRawText(text)
    if (text.trim()) {
      setCsvAnalysis(parseTeamCsvContent(text))
    } else {
      setCsvAnalysis(null)
    }
    setImportSummary(null)
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

  const handleExecuteCsvImport = () => {
    if (!csvAnalysis || csvAnalysis.validRows.length === 0) return

    const result = store.importUsers(csvAnalysis.validRows)
    const msg = `Import complete: ${result.imported} created, ${result.updated} updated.`
    setImportSummary(msg)
    onToast?.('success', msg)

    setTimeout(() => {
      setIsCsvModalOpen(false)
      setCsvRawText('')
      setCsvAnalysis(null)
      setImportSummary(null)
    }, 900)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Team & Role Management
          </h3>
          <p className="text-xs text-slate-500">
            Manage authorized team members, roles, and access credentials across any email domain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Download CSV template"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>CSV Template</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Import Team CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Email Address</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold text-[11px]">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <Shield className="h-3 w-3 text-amber-500" />
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
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="marketing_intern">Marketing Intern</option>
                      <option value="marketing_lead">Marketing Lead</option>
                      <option value="administrator">Administrator</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-amber-500" />
                Add Team Member
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              {addError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com, student@university.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="First Last"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="marketing_intern">Marketing Intern (Drafts & submits)</option>
                  <option value="marketing_lead">Marketing Lead (Approves & sends)</option>
                  <option value="administrator">Administrator (Full control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Team CSV Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                Import Team Roster from CSV
              </h4>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Upload or paste a CSV file with columns:{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  email,name,role
                </code>
                . Supports all individual email addresses (Gmail, Outlook, university domains, etc.).
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
                <span className="text-xs text-slate-400">or paste CSV text directly below</span>
              </div>

              <textarea
                rows={4}
                value={csvRawText}
                onChange={(e) => handleCsvTextChange(e.target.value)}
                placeholder="email,name,role&#10;sarah.lead@gmail.com,Sarah Jenkins,marketing_lead&#10;alex@stanford.edu,Alex Rivera,marketing_intern"
                className="w-full font-mono text-xs rounded-lg border border-slate-300 p-2.5 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />

              {csvAnalysis && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-xs">
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
                    <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 max-h-28 overflow-y-auto space-y-1">
                      {csvAnalysis.invalidRows.map((err, idx) => (
                        <div key={idx}>
                          Row {err.rowNumber}: {err.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {csvAnalysis.validRows.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-1.5">Email</th>
                            <th className="px-3 py-1.5">Name</th>
                            <th className="px-3 py-1.5">Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                          {csvAnalysis.validRows.map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-slate-900 dark:text-white">{r.email}</td>
                              <td className="px-3 py-1.5 font-sans">{r.full_name}</td>
                              <td className="px-3 py-1.5 text-amber-600 dark:text-amber-400">
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

              {importSummary && (
                <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {importSummary}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!csvAnalysis || csvAnalysis.validRows.length === 0}
                onClick={handleExecuteCsvImport}
                className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {csvAnalysis?.validRows.length || 0} Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
