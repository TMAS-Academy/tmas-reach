import { useState, useMemo } from 'react'
import type { Contact, ContactStatus, UserRole, Campaign } from '../../types'
import { hasPermission } from '../../lib/rbac'
import { store } from '../../lib/store'
import { ContactFormModal } from './ContactFormModal'
import { CsvImportModal } from './CsvImportModal'
import { ContactHistoryDrawer } from './ContactHistoryDrawer'
import { EducatorSurveyForm } from '../survey/EducatorSurveyForm'
import {
  Search,
  Plus,
  Upload,
  Download,
  UserCheck,
  UserX,
  AlertCircle,
  ShieldAlert,
  Edit2,
  Lock,
  History,
  School,
} from 'lucide-react'

interface ContactListProps {
  contacts: Contact[]
  campaigns?: Campaign[]
  userRole: UserRole
}

export function ContactList({ contacts, campaigns = [], userRole }: ContactListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCsvOpen, setIsCsvOpen] = useState(false)
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [historyContact, setHistoryContact] = useState<Contact | null>(null)
  const [rbacAlert, setRbacAlert] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  const handleExportCsv = () => {
    const headers = 'email,first_name,last_name,organization,job_role,audience_tag,status'
    const rows = filteredContacts.map(
      (c) =>
        `"${c.email}","${c.first_name || ''}","${c.last_name || ''}","${c.organization || ''}","${c.job_role || ''}","${c.audience_tag || ''}","${c.status}"`
    )
    const content = [headers, ...rows].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmas_reach_contacts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const canSuppress = hasPermission(userRole, 'contacts:suppress')

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>()
    contacts.forEach((c) => {
      if (c.audience_tag) tags.add(c.audience_tag)
    })
    return Array.from(tags)
  }, [contacts])

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      active: contacts.filter((c) => c.status === 'active').length,
      unsubscribed: contacts.filter((c) => c.status === 'unsubscribed').length,
      bounced: contacts.filter((c) => c.status === 'bounced').length,
      suppressed: contacts.filter((c) => c.status === 'suppressed').length,
    }
  }, [contacts])

  const filteredContacts = contacts.filter((c) => {
    const query = searchTerm.toLowerCase()
    const matchesSearch =
      !query ||
      c.email.toLowerCase().includes(query) ||
      `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(query) ||
      (c.organization && c.organization.toLowerCase().includes(query)) ||
      (c.job_role && c.job_role.toLowerCase().includes(query))

    const matchesTag = selectedTag === 'all' || c.audience_tag === selectedTag
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus

    return matchesSearch && matchesTag && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE))
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const handleStatusChange = (contact: Contact, newStatus: ContactStatus) => {
    if (newStatus === 'suppressed' && !canSuppress) {
      setRbacAlert('Manual suppression requires Marketing Lead or Administrator permission.')
      setTimeout(() => setRbacAlert(null), 4000)
      return
    }
    store.setContactStatus(contact.id, newStatus)
  }

  const renderStatusBadge = (status: ContactStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <UserCheck className="h-3 w-3" /> Active
          </span>
        )
      case 'unsubscribed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            <UserX className="h-3 w-3" /> Unsubscribed
          </span>
        )
      case 'bounced':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
            <AlertCircle className="h-3 w-3" /> Bounced
          </span>
        )
      case 'suppressed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-400">
            <ShieldAlert className="h-3 w-3" /> Suppressed
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {rbacAlert && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900">
          <Lock className="h-4 w-4 shrink-0" />
          <span>{rbacAlert}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="group rounded-xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Contacts</span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">{stats.total}</div>
        </div>
        <div className="group rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/40">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active Outreach</span>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</div>
        </div>
        <div className="group rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500/40">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Unsubscribed</span>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">{stats.unsubscribed}</div>
        </div>
        <div className="group rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-500/40">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Hard Bounced</span>
          <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">{stats.bounced}</div>
        </div>
        <div className="group rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-purple-500/40">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Suppressed</span>
          <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 mt-0.5">{stats.suppressed}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts, organization, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Audience Tags</option>
            {uniqueTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-102"
            title="Export filtered contacts to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setIsCsvOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-102"
          >
            <Upload className="h-4 w-4 text-slate-400" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingContact(null)
              setIsFormOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 shadow-sm shadow-amber-400/20 transition-all hover:scale-103 active:scale-97 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Organization & Role</th>
              <th className="px-4 py-3">Audience Tag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  {contacts.length === 0 ? (
                    <div className="mx-auto max-w-md space-y-4 py-8">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-500 dark:text-amber-400 shadow-[0_0_25px_rgba(250,204,21,0.2)] animate-subtle-float">
                        <School className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                          No contacts yet
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                          Add contacts manually, import a CSV, or review intake survey responses.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsSurveyModalOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 shadow-sm shadow-amber-400/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <School className="h-4 w-4" />
                          <span>Open Intake Survey</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCsvOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Upload className="h-4 w-4 text-slate-400" />
                          <span>Upload CSV</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">No contacts found matching the filters.</span>
                  )}
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {contact.first_name || contact.last_name
                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                        : '—'}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{contact.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800 dark:text-slate-200">
                      {contact.organization || '—'}
                    </div>
                    <div className="text-xs text-slate-500">{contact.job_role || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {contact.audience_tag ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {contact.audience_tag}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{renderStatusBadge(contact.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryContact(contact)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="View Outreach History"
                      >
                        <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContact(contact)
                          setIsFormOpen(true)
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit Contact"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {contact.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(contact, 'suppressed')}
                          className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                          title={
                            canSuppress
                              ? 'Manually Suppress'
                              : 'Manual suppression requires Lead/Admin permission'
                          }
                        >
                          Suppress
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(contact, 'active')}
                          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filteredContacts.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800 text-xs text-slate-500">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {(currentPage - 1) * PAGE_SIZE + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(currentPage * PAGE_SIZE, filteredContacts.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {filteredContacts.length}
              </span>{' '}
              contacts
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => setIsFormOpen(false)}
          onSaved={() => setIsFormOpen(false)}
        />
      )}

      {isCsvOpen && (
        <CsvImportModal
          existingContacts={contacts}
          onClose={() => setIsCsvOpen(false)}
          onImported={() => setIsCsvOpen(false)}
        />
      )}

      {isSurveyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl my-8">
            <EducatorSurveyForm
              onSuccess={() => setIsSurveyModalOpen(false)}
              onCancel={() => setIsSurveyModalOpen(false)}
            />
          </div>
        </div>
      )}

      {historyContact && (
        <ContactHistoryDrawer
          contact={historyContact}
          campaigns={campaigns}
          userRole={userRole}
          onClose={() => setHistoryContact(null)}
          onStatusChanged={() => {
            const updated = store.getContacts().find((c) => c.id === historyContact.id)
            setHistoryContact(updated || null)
          }}
        />
      )}
    </div>
  )
}
