import { useState, useMemo, useEffect, useRef } from 'react'
import type { Contact, ContactStatus, UserRole, Campaign } from '../../types'
import { hasPermission } from '../../lib/rbac'
import { store } from '../../lib/store'
import { ContactFormModal } from './ContactFormModal'
import { CsvImportModal } from './CsvImportModal'
import { ContactHistoryDrawer } from './ContactHistoryDrawer'
import { EducatorSurveyForm } from '../survey/EducatorSurveyForm'
import { ModalShell } from '../ui/ModalShell'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { ToastType } from '../ui/Toast'
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
  History,
  School,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'

interface ContactListProps {
  contacts: Contact[]
  campaigns?: Campaign[]
  userRole: UserRole
  onToast?: (type: ToastType, text: string) => void
}

type SortField = 'name' | 'organization' | 'status'
type SortDir = 'asc' | 'desc'

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function ContactList({
  contacts,
  campaigns = [],
  userRole,
  onToast,
}: ContactListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSchool, setSelectedSchool] = useState<string>('all')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCsvOpen, setIsCsvOpen] = useState(false)
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [historyContact, setHistoryContact] = useState<Contact | null>(null)
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)

  const canSuppress = hasPermission(userRole, 'contacts:suppress')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>()
    contacts.forEach((c) => {
      if (c.audience_tag) tags.add(c.audience_tag)
    })
    return Array.from(tags).sort()
  }, [contacts])

  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>()
    contacts.forEach((c) => {
      if (c.organization?.trim()) schools.add(c.organization.trim())
    })
    return Array.from(schools).sort()
  }, [contacts])

  const uniqueDistricts = useMemo(() => {
    const districts = new Set<string>()
    contacts.forEach((c) => {
      if (c.district?.trim()) districts.add(c.district.trim())
    })
    return Array.from(districts).sort()
  }, [contacts])

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>()
    contacts.forEach((c) => {
      if (c.job_role?.trim()) roles.add(c.job_role.trim())
    })
    return Array.from(roles).sort()
  }, [contacts])

  const stats = useMemo(() => {
    let active = 0
    let unsubscribed = 0
    let bounced = 0
    let suppressed = 0
    contacts.forEach((c) => {
      if (c.status === 'active') active++
      else if (c.status === 'unsubscribed') unsubscribed++
      else if (c.status === 'bounced') bounced++
      else if (c.status === 'suppressed') suppressed++
    })
    return { total: contacts.length, active, unsubscribed, bounced, suppressed }
  }, [contacts])

  const filteredContacts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const filtered = contacts.filter((c) => {
      const matchesSearch =
        !query ||
        c.email.toLowerCase().includes(query) ||
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(query) ||
        (c.organization && c.organization.toLowerCase().includes(query)) ||
        (c.district && c.district.toLowerCase().includes(query)) ||
        (c.job_role && c.job_role.toLowerCase().includes(query))

      const matchesTag = selectedTag === 'all' || c.audience_tag === selectedTag
      const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus
      const matchesSchool = selectedSchool === 'all' || c.organization === selectedSchool
      const matchesDistrict = selectedDistrict === 'all' || c.district === selectedDistrict
      const matchesRole = selectedRole === 'all' || c.job_role === selectedRole

      return (
        matchesSearch &&
        matchesTag &&
        matchesStatus &&
        matchesSchool &&
        matchesDistrict &&
        matchesRole
      )
    })

    if (!sortField) return filtered

    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === 'name') {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email
        return nameA.localeCompare(nameB) * dir
      }
      if (sortField === 'organization') {
        return (a.organization || '').localeCompare(b.organization || '') * dir
      }
      return a.status.localeCompare(b.status) * dir
    })
  }, [
    contacts,
    searchTerm,
    selectedTag,
    selectedStatus,
    selectedSchool,
    selectedDistrict,
    selectedRole,
    sortField,
    sortDir,
  ])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedTag !== 'all' ||
    selectedStatus !== 'all' ||
    selectedSchool !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedRole !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedTag('all')
    setSelectedStatus('all')
    setSelectedSchool('all')
    setSelectedDistrict('all')
    setSelectedRole('all')
    setCurrentPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedContacts = filteredContacts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const toggleSort = (field: SortField) => {
    setCurrentPage(1)
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-amber-600 dark:text-amber-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-amber-600 dark:text-amber-400" />
    )
  }

  const toggleSelectContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allOnPageSelected =
    paginatedContacts.length > 0 && paginatedContacts.every((c) => selectedContactIds.has(c.id))

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedContactIds(new Set())
    } else {
      setSelectedContactIds(new Set(paginatedContacts.map((c) => c.id)))
    }
  }

  const handleDeleteSingle = (contact: Contact) => {
    setConfirmState({
      title: 'Delete contact?',
      message: `Remove ${contact.email} and any associated recipient history from this workspace?`,
      confirmLabel: 'Delete contact',
      onConfirm: () => {
        store.deleteContact(contact.id)
        setSelectedContactIds((prev) => {
          const next = new Set(prev)
          next.delete(contact.id)
          return next
        })
        setConfirmState(null)
        onToast?.('info', `Deleted ${contact.email}.`)
      },
    })
  }

  const handleDeleteSelected = () => {
    if (selectedContactIds.size === 0) return
    const count = selectedContactIds.size
    setConfirmState({
      title: `Delete ${count} selected contact${count === 1 ? '' : 's'}?`,
      message: 'Selected contacts and their delivery records will be permanently removed.',
      confirmLabel: `Delete ${count}`,
      onConfirm: () => {
        store.deleteContacts(Array.from(selectedContactIds))
        setSelectedContactIds(new Set())
        setConfirmState(null)
        onToast?.('info', `Deleted ${count} contact(s).`)
      },
    })
  }

  const handleBulkSuppress = () => {
    if (!canSuppress) {
      onToast?.('error', 'Manual suppression requires Marketing Lead or Administrator permission.')
      return
    }
    const count = selectedContactIds.size
    selectedContactIds.forEach((id) => store.setContactStatus(id, 'suppressed'))
    setSelectedContactIds(new Set())
    onToast?.('info', `Suppressed ${count} contact(s).`)
  }

  const handleExportCsv = () => {
    const headers = 'email,first_name,last_name,organization,district,job_role,audience_tag,status'
    const rows = filteredContacts.map((c) =>
      [
        c.email,
        c.first_name || '',
        c.last_name || '',
        c.organization || '',
        c.district || '',
        c.job_role || '',
        c.audience_tag || '',
        c.status,
      ]
        .map(escapeCsvCell)
        .join(',')
    )
    const content = [headers, ...rows].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmas_reach_contacts.csv'
    a.click()
    URL.revokeObjectURL(url)
    onToast?.('success', `Exported ${filteredContacts.length} contact(s) to CSV.`)
  }

  const handleStatusChange = (contact: Contact, newStatus: ContactStatus) => {
    if (newStatus === 'suppressed' && !canSuppress) {
      onToast?.('error', 'Manual suppression requires Marketing Lead or Administrator permission.')
      return
    }
    store.setContactStatus(contact.id, newStatus)
    onToast?.(
      'info',
      `${contact.email} marked as ${newStatus}.`
    )
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
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
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

  const kpiCards: {
    key: string
    label: string
    value: number
    accent: string
    labelClass: string
    valueClass: string
  }[] = [
    {
      key: 'all',
      label: 'Total Contacts',
      value: stats.total,
      accent: 'border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900',
      labelClass: 'text-slate-600 dark:text-slate-400',
      valueClass: 'text-slate-900 dark:text-white',
    },
    {
      key: 'active',
      label: 'Active Outreach',
      value: stats.active,
      accent: 'border-emerald-500/25 bg-emerald-500/5',
      labelClass: 'text-emerald-700 dark:text-emerald-400',
      valueClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      key: 'unsubscribed',
      label: 'Unsubscribed',
      value: stats.unsubscribed,
      accent: 'border-amber-500/25 bg-amber-500/5',
      labelClass: 'text-amber-700 dark:text-amber-400',
      valueClass: 'text-amber-700 dark:text-amber-400',
    },
    {
      key: 'bounced',
      label: 'Hard Bounced',
      value: stats.bounced,
      accent: 'border-rose-500/25 bg-rose-500/5',
      labelClass: 'text-rose-700 dark:text-rose-400',
      valueClass: 'text-rose-700 dark:text-rose-400',
    },
    {
      key: 'suppressed',
      label: 'Suppressed',
      value: stats.suppressed,
      accent: 'border-purple-500/25 bg-purple-500/5',
      labelClass: 'text-purple-700 dark:text-purple-400',
      valueClass: 'text-purple-700 dark:text-purple-400',
    },
  ]

  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpiCards.map((card) => {
          const isSelected = selectedStatus === card.key
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setSelectedStatus((prev) =>
                  card.key === 'all' ? 'all' : prev === card.key ? 'all' : card.key
                )
                setCurrentPage(1)
              }}
              className={`rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${card.accent} ${
                isSelected
                  ? 'ring-2 ring-amber-400/80 shadow-sm'
                  : 'hover:-translate-y-0.5 hover:shadow-xs'
              }`}
            >
              <span className={`text-xs font-semibold ${card.labelClass}`}>{card.label}</span>
              <div className={`mt-0.5 text-2xl font-bold tracking-tight ${card.valueClass}`}>
                {card.value}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search contacts, school, role... (press /)"
              aria-label="Search contacts"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <select
            aria-label="Filter by audience tag"
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value)
              setCurrentPage(1)
            }}
            className={selectClass}
          >
            <option value="all">All Tags</option>
            {uniqueTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          {uniqueSchools.length > 0 && (
            <select
              aria-label="Filter by school"
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value)
                setCurrentPage(1)
              }}
              className={selectClass}
            >
              <option value="all">All Schools</option>
              {uniqueSchools.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {uniqueDistricts.length > 0 && (
            <select
              aria-label="Filter by district"
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value)
                setCurrentPage(1)
              }}
              className={selectClass}
            >
              <option value="all">All Districts</option>
              {uniqueDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {uniqueRoles.length > 0 && (
            <select
              aria-label="Filter by role"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value)
                setCurrentPage(1)
              }}
              className={selectClass}
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="Filter by status"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setCurrentPage(1)
            }}
            className={selectClass}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
            <option value="suppressed">Suppressed</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredContacts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            title="Export filtered contacts to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setIsCsvOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingContact(null)
              setIsFormOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>
      </div>

      {selectedContactIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-medium">{selectedContactIds.size} contact(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkSuppress}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Suppress Selected
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="rounded-lg bg-rose-600 px-2.5 py-1 font-medium text-white hover:bg-rose-700"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedContactIds(new Set())}
              className="text-slate-600 hover:underline dark:text-slate-300"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all contacts on this page"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 accent-amber-500 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    title="Select all on this page"
                  />
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white"
                  >
                    Contact {renderSortIcon('name')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('organization')}
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white"
                  >
                    Organization & Role {renderSortIcon('organization')}
                  </button>
                </th>
                <th className="px-4 py-3">Audience Tag</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white"
                  >
                    Status {renderSortIcon('status')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    {contacts.length === 0 ? (
                      <div className="mx-auto max-w-md space-y-4 py-6">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400">
                          <School className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                            No contacts yet
                          </h3>
                          <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            Add contacts manually, import a CSV, or collect details with the intake
                            survey.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsSurveyModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs cursor-pointer"
                          >
                            <School className="h-4 w-4" />
                            <span>Open Intake Survey</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCsvOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 cursor-pointer"
                          >
                            <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <span>Upload CSV</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 py-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          No contacts found matching the current filters.
                        </p>
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => {
                  const displayName =
                    contact.first_name || contact.last_name
                      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      : '—'
                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${contact.email}`}
                          checked={selectedContactIds.has(contact.id)}
                          onChange={() => toggleSelectContact(contact.id)}
                          className="rounded border-slate-300 accent-amber-500 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {displayName}
                        </div>
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {contact.email}
                        </div>
                        {contact.notes && (
                          <div
                            className="mt-1 max-w-xs truncate text-[11px] italic text-slate-500 dark:text-slate-400"
                            title={contact.notes}
                          >
                            {contact.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {contact.organization || '—'}
                        </div>
                        {contact.district && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {contact.district}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {contact.job_role || '—'}
                        </div>
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
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHistoryContact(contact)}
                            aria-label={`View outreach history for ${contact.email}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            title="View Outreach History"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(contact)
                              setIsFormOpen(true)
                            }}
                            aria-label={`Edit ${contact.email}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            title="Edit Contact"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(contact)}
                            aria-label={`Delete ${contact.email}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            title="Delete Contact"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {contact.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(contact, 'suppressed')}
                              className="rounded px-1.5 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40"
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
                              className="rounded px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredContacts.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {(safePage - 1) * PAGE_SIZE + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(safePage * PAGE_SIZE, filteredContacts.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredContacts.length}
              </span>{' '}
              contacts
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
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
          onSaved={(msg) => {
            setIsFormOpen(false)
            if (msg) onToast?.('success', msg)
          }}
        />
      )}

      {isCsvOpen && (
        <CsvImportModal
          existingContacts={contacts}
          onClose={() => setIsCsvOpen(false)}
          onImported={(count) => {
            setIsCsvOpen(false)
            onToast?.('success', `Imported ${count} contact(s) from CSV.`)
          }}
        />
      )}

      {isSurveyModalOpen && (
        <ModalShell
          onClose={() => setIsSurveyModalOpen(false)}
          title="Educator & School Outreach Survey"
          subtitle="Collect verified educator details for TMAS Academy outreach."
          size="lg"
        >
          <EducatorSurveyForm
            embedded
            onSuccess={() => setIsSurveyModalOpen(false)}
            onCancel={() => setIsSurveyModalOpen(false)}
          />
        </ModalShell>
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
            onToast?.('info', 'Contact status updated.')
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        tone="danger"
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
