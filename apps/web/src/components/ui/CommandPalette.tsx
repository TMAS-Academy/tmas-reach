import { useEffect, useMemo, useRef, useState } from 'react'
import type { Campaign, Contact, EmailTemplate } from '../../types'
import type { TabKey } from '../layout/Navbar'
import {
  Search,
  Users,
  School,
  FileText,
  Send,
  BarChart2,
  History,
  Shield,
  ExternalLink,
  Sun,
  Moon,
  RotateCcw,
  CornerDownLeft,
} from 'lucide-react'

interface CommandItem {
  id: string
  group: 'Navigation' | 'Contacts' | 'Campaigns' | 'Templates' | 'Actions'
  label: string
  hint?: string
  icon: React.ReactNode
  onSelect: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectTab: (tab: TabKey) => void
  isAdmin: boolean
  isDark: boolean
  onToggleTheme: () => void
  onRequestReset: () => void
  contacts: Contact[]
  templates: EmailTemplate[]
  campaigns: Campaign[]
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectTab,
  isAdmin,
  isDark,
  onToggleTheme,
  onRequestReset,
  contacts,
  templates,
  campaigns,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [isOpen])

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase()
    const list: CommandItem[] = [
      {
        id: 'nav-contacts',
        group: 'Navigation',
        label: 'Contacts Directory',
        hint: 'View & manage educators',
        icon: <Users className="h-4 w-4" />,
        onSelect: () => onSelectTab('contacts'),
      },
      {
        id: 'nav-intake',
        group: 'Navigation',
        label: 'Intake Survey',
        hint: 'Review submissions',
        icon: <School className="h-4 w-4" />,
        onSelect: () => onSelectTab('intake'),
      },
      {
        id: 'nav-templates',
        group: 'Navigation',
        label: 'Email Templates',
        hint: 'Manage personalized templates',
        icon: <FileText className="h-4 w-4" />,
        onSelect: () => onSelectTab('templates'),
      },
      {
        id: 'nav-campaigns',
        group: 'Navigation',
        label: 'Campaigns',
        hint: 'Approval & batch dispatch',
        icon: <Send className="h-4 w-4" />,
        onSelect: () => onSelectTab('campaigns'),
      },
      {
        id: 'nav-analytics',
        group: 'Navigation',
        label: 'Analytics',
        hint: 'Delivery & school metrics',
        icon: <BarChart2 className="h-4 w-4" />,
        onSelect: () => onSelectTab('analytics'),
      },
      {
        id: 'nav-logs',
        group: 'Navigation',
        label: 'Audit Trail',
        hint: 'Activity logs',
        icon: <History className="h-4 w-4" />,
        onSelect: () => onSelectTab('logs'),
      },
      ...(isAdmin
        ? [
            {
              id: 'nav-admin',
              group: 'Navigation' as const,
              label: 'Team & RBAC',
              hint: 'Manage roles & members',
              icon: <Shield className="h-4 w-4" />,
              onSelect: () => onSelectTab('admin'),
            },
          ]
        : []),
      {
        id: 'nav-unsubscribe',
        group: 'Navigation',
        label: 'Unsubscribe Portal',
        hint: 'Public opt-out preview',
        icon: <ExternalLink className="h-4 w-4" />,
        onSelect: () => onSelectTab('unsubscribe'),
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        hint: 'Toggle color theme',
        icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        onSelect: onToggleTheme,
      },
      {
        id: 'act-reset',
        group: 'Actions',
        label: 'Reset Demo Data',
        hint: 'Restore initial workspace state',
        icon: <RotateCcw className="h-4 w-4" />,
        onSelect: onRequestReset,
      },
    ]

    if (q) {
      contacts
        .filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
            (c.organization || '').toLowerCase().includes(q)
        )
        .slice(0, 5)
        .forEach((c) => {
          list.push({
            id: `cnt-${c.id}`,
            group: 'Contacts',
            label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
            hint: c.organization ? `${c.email} • ${c.organization}` : c.email,
            icon: <Users className="h-4 w-4" />,
            onSelect: () => onSelectTab('contacts'),
          })
        })

      campaigns
        .filter((c) => c.name.toLowerCase().includes(q) || c.status.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((c) => {
          list.push({
            id: `cmp-${c.id}`,
            group: 'Campaigns',
            label: c.name,
            hint: c.status.replace('_', ' '),
            icon: <Send className="h-4 w-4" />,
            onSelect: () => onSelectTab('campaigns'),
          })
        })

      templates
        .filter(
          (t) =>
            t.name.toLowerCase().includes(q) || t.subject_template.toLowerCase().includes(q)
        )
        .slice(0, 5)
        .forEach((t) => {
          list.push({
            id: `tpl-${t.id}`,
            group: 'Templates',
            label: t.name,
            hint: t.subject_template,
            icon: <FileText className="h-4 w-4" />,
            onSelect: () => onSelectTab('templates'),
          })
        })
    }

    if (!q) return list

    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint || '').toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    )
  }, [query, isAdmin, isDark, onSelectTab, onToggleTheme, onRequestReset, contacts, templates, campaigns])

  const activeIndex = items.length > 0 ? Math.min(selectedIndex, items.length - 1) : 0

  const handleClose = () => {
    setQuery('')
    setSelectedIndex(0)
    onClose()
  }

  const executeItem = (item: CommandItem) => {
    handleClose()
    item.onSelect()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setQuery('')
        setSelectedIndex(0)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/65 p-4 pt-[12vh] backdrop-blur-sm animate-backdrop-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-modal-in"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) =>
                  items.length > 0 ? (prev - 1 + items.length) % items.length : 0
                )
              } else if (e.key === 'Enter' && items[activeIndex]) {
                e.preventDefault()
                executeItem(items[activeIndex])
              }
            }}
            placeholder="Jump to a tab, contact, campaign, template, or action..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <kbd className="hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching views, records, or actions for "{query}".
            </div>
          ) : (
            <ul role="listbox" className="space-y-0.5">
              {items.map((item, idx) => {
                const isSelected = idx === activeIndex
                return (
                  <li key={item.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => executeItem(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-amber-400/15 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={
                            isSelected
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.label}</div>
                          {item.hint && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.hint}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {item.group}
                        </span>
                        {isSelected && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
