import { useState, useEffect } from 'react'
import type { User, UserRole } from '../../types'
import { formatRoleLabel } from '../../lib/rbac'
import tmasLogo from '../../assets/tmas-logo.jpg'
import {
  Users,
  FileText,
  Send,
  BarChart2,
  History,
  Shield,
  ExternalLink,
  ChevronDown,
  Sun,
  Moon,
  School,
} from 'lucide-react'

export type TabKey =
  | 'contacts'
  | 'intake'
  | 'templates'
  | 'campaigns'
  | 'analytics'
  | 'logs'
  | 'admin'
  | 'unsubscribe'

interface NavbarProps {
  activeTab: TabKey
  onSelectTab: (tab: TabKey) => void
  currentUser: User
  onRoleChange: (role: UserRole) => void
}

export function Navbar({
  activeTab,
  onSelectTab,
  currentUser,
  onRoleChange,
}: NavbarProps) {
  const isAdmin = currentUser.role === 'administrator'
  const [isDark, setIsDark] = useState(() => {
    try {
      const urlTheme = new URLSearchParams(window.location.search).get('theme')
      if (urlTheme === 'dark') return true
      if (urlTheme === 'light') return false
      const stored = localStorage.getItem('tmas_theme')
      if (stored === 'light') return false
      return true
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('tmas_theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('tmas_theme', 'light')
      }
    } catch {
      // Storage unavailable
    }
  }, [isDark])

  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'contacts', label: 'Contacts', icon: <Users className="h-4 w-4" /> },
    { key: 'intake', label: 'Intake Survey', icon: <School className="h-4 w-4" /> },
    { key: 'templates', label: 'Templates', icon: <FileText className="h-4 w-4" /> },
    { key: 'campaigns', label: 'Campaigns', icon: <Send className="h-4 w-4" /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart2 className="h-4 w-4" /> },
    { key: 'logs', label: 'Audit Trail', icon: <History className="h-4 w-4" /> },
  ]

  if (isAdmin) {
    navItems.push({
      key: 'admin',
      label: 'Team & RBAC',
      icon: <Shield className="h-4 w-4" />,
    })
  }

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src={tmasLogo}
            alt="TMAS Academy"
            className="h-10 w-10 rounded-lg object-contain bg-black shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                TMAS Reach
              </span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                v1.0 Release
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Outreach & Campaign Management for TMAS Academy
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-500" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('unsubscribe')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium border ${
              activeTab === 'unsubscribe'
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
            title="Preview public recipient unsubscribe endpoint"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Unsubscribe Portal</span>
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="pl-2 text-[11px] text-slate-500">Active Role:</div>
            <div className="relative">
              <select
                value={currentUser.role}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className="appearance-none rounded-md bg-white py-1 pl-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <option value="marketing_intern">Marketing Intern</option>
                <option value="marketing_lead">Marketing Lead</option>
                <option value="administrator">Administrator</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 dark:border-slate-800/80">
        <nav className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="bg-slate-50/70 px-4 py-1.5 text-[11px] text-slate-500 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            Logged in as <strong>{currentUser.full_name}</strong> (
            <span className="font-mono text-indigo-600 dark:text-indigo-400">
              {formatRoleLabel(currentUser.role)}
            </span>
            )
          </div>
          <div className="hidden sm:block">
            {currentUser.role === 'marketing_intern' &&
              'Permissions: Import/edit contacts, templates, draft campaigns, submit for review.'}
            {currentUser.role === 'marketing_lead' &&
              'Permissions: Full outreach control, campaign approvals, suppression, and dispatch.'}
            {currentUser.role === 'administrator' &&
              'Permissions: Full administrative and RBAC management.'}
          </div>
        </div>
      </div>
    </header>
  )
}
