import type { User, UserRole } from '../../types'
import { formatRoleLabel } from '../../lib/rbac'
import { ConnectionBadge } from '../ui/ConnectionBadge'
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
  Search,
  KeyRound,
  LogOut,
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
  users?: User[]
  onSelectUser?: (userId: string) => void
  onRoleChange: (role: UserRole) => void
  isDark: boolean
  onToggleTheme: () => void
  onOpenCommandPalette: () => void
  pendingApprovalsCount?: number
  pendingSurveysCount?: number
  isApiMode?: boolean
  onSignOut?: () => void
  onOpenChangePassword?: () => void
  onSyncNow?: () => void
}

export function Navbar({
  activeTab,
  onSelectTab,
  currentUser,
  users,
  onSelectUser,
  onRoleChange,
  isDark,
  onToggleTheme,
  onOpenCommandPalette,
  pendingApprovalsCount = 0,
  pendingSurveysCount = 0,
  isApiMode = false,
  onSignOut,
  onOpenChangePassword,
  onSyncNow,
}: NavbarProps) {
  const isAdmin = currentUser.role === 'administrator'

  const navItems: {
    key: TabKey
    label: string
    icon: React.ReactNode
    badgeCount?: number
  }[] = [
    {
      key: 'contacts',
      label: 'Contacts',
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: 'intake',
      label: 'Intake Survey',
      icon: <School className="h-4 w-4" />,
      badgeCount: pendingSurveysCount,
    },
    {
      key: 'templates',
      label: 'Templates',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      key: 'campaigns',
      label: 'Campaigns',
      icon: <Send className="h-4 w-4" />,
      badgeCount: pendingApprovalsCount,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <BarChart2 className="h-4 w-4" />,
    },
    {
      key: 'logs',
      label: 'Audit Trail',
      icon: <History className="h-4 w-4" />,
    },
  ]

  if (isAdmin) {
    navItems.push({
      key: 'admin',
      label: 'Team & RBAC',
      icon: <Shield className="h-4 w-4" />,
    })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs dark:border-slate-800/80 dark:bg-slate-900/95 transition-colors">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('contacts')}
            className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            title="Go to Contacts"
          >
            <img
              src={tmasLogo}
              alt="TMAS Academy"
              className="h-9 w-9 rounded-lg object-contain bg-black shadow-xs transition-transform duration-200 hover:scale-105"
            />
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              TMAS Reach
            </span>
          </button>
          <ConnectionBadge onRefresh={onSyncNow} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
            title="Open quick search (Ctrl+K)"
            aria-label="Open quick search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[10px] text-slate-500 sm:inline dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden lg:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-700" />
                <span className="hidden lg:inline">Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('unsubscribe')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors ${
              activeTab === 'unsubscribe'
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/40'
                : 'text-slate-700 border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
            title="Preview public recipient unsubscribe page"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Unsubscribe</span>
          </button>

          {isApiMode ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/80"
                title={`Signed in as ${currentUser.full_name} (${currentUser.email})`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentUser.full_name}
                </span>
                <span className="hidden sm:inline rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300">
                  {formatRoleLabel(currentUser.role)}
                </span>
              </div>
              {onOpenChangePassword && (
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  title="Change password"
                  aria-label="Change password"
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Sign Out</span>
                </button>
              )}
            </div>
          ) : (
            <div
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-1 dark:border-slate-800 dark:bg-slate-800/80"
              title={`Signed in as ${currentUser.full_name} (${currentUser.email})`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <div className="relative">
                <label htmlFor="active-user-select" className="sr-only">
                  Active team member
                </label>
                <select
                  id="active-user-select"
                  value={users && users.length > 0 ? currentUser.id : currentUser.role}
                  onChange={(e) => {
                    if (users && onSelectUser) {
                      onSelectUser(e.target.value)
                    } else {
                      onRoleChange(e.target.value as UserRole)
                    }
                  }}
                  className="appearance-none rounded-md bg-white py-0.5 pl-2 pr-6 text-xs font-semibold text-slate-800 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  {users && users.length > 0 ? (
                    users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({formatRoleLabel(u.role)})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="marketing_intern">Marketing Intern</option>
                      <option value="marketing_lead">Marketing Lead</option>
                      <option value="administrator">Administrator</option>
                    </>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 dark:border-slate-800/80">
        <nav
          role="tablist"
          aria-label="Workspace sections"
          className="mx-auto flex max-w-7xl space-x-1.5 overflow-x-auto py-1.5"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.key
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(item.key)}
                className={`group relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors ${
                  isActive
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-300 font-semibold dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/40'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 border border-transparent'
                }`}
              >
                <span
                  className={
                    isActive
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                  }
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      isActive
                        ? 'bg-amber-700 text-white dark:bg-amber-400 dark:text-slate-950'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
