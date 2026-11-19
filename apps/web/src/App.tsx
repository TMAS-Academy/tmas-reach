import { useState, useEffect, useCallback, useMemo } from 'react'
import { store } from './lib/store'
import { useAppStore } from './lib/useAppStore'
import { apiClient } from './lib/apiClient'
import { getAuthStatus, logoutSession, restoreSession } from './lib/authSession'
import type { User, UserRole } from './types'
import { Navbar, type TabKey } from './components/layout/Navbar'
import { LoginView } from './components/auth/LoginView'
import { ChangePasswordModal } from './components/auth/ChangePasswordModal'
import {
  ToastContainer,
  MAX_VISIBLE_TOASTS,
  type ToastMessage,
  type ToastType,
} from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { CommandPalette } from './components/ui/CommandPalette'
import { ContactList } from './components/contacts/ContactList'
import { TemplateList } from './components/templates/TemplateList'
import { CampaignList } from './components/campaigns/CampaignList'
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard'
import { ActivityLogs } from './components/analytics/ActivityLogs'
import { UserManagement } from './components/admin/UserManagement'
import { UnsubscribePortal } from './components/unsubscribe/UnsubscribePortal'
import { SurveyHub } from './components/survey/SurveyHub'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import './App.css'

const VALID_TABS = new Set<TabKey>([
  'contacts',
  'intake',
  'templates',
  'campaigns',
  'analytics',
  'logs',
  'admin',
  'unsubscribe',
])

function readTabFromUrl(): TabKey {
  try {
    if (window.location.pathname.startsWith('/unsubscribe/')) {
      return 'unsubscribe'
    }
    const param = new URLSearchParams(window.location.search).get('tab') as TabKey | null
    if (param && VALID_TABS.has(param)) {
      return param
    }
  } catch {
    // Ignore malformed URLs
  }
  return 'contacts'
}

export default function App() {
  const isApiConfigured = apiClient.isConfigured()
  const snapshot = useAppStore()
  const { currentUser, contacts, templates, campaigns, logs, users, surveys, storageError } =
    snapshot

  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>(readTabFromUrl)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'authenticated'>(
    isApiConfigured ? 'checking' : 'authenticated'
  )
  const [authInitialized, setAuthInitialized] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
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

  const isApiMode = isApiConfigured && authState === 'authenticated' && store.isApiMode()

  const addToast = useCallback((type: ToastType, text: string) => {
    setToasts((prev) => [
      ...prev.slice(-(MAX_VISIBLE_TOASTS - 1)),
      { id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, text },
    ])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const bootstrapAuthSession = useCallback(async () => {
    if (!isApiConfigured) return
    setAuthState('checking')
    setAuthError(null)
    try {
      const [status, restoredUser] = await Promise.all([getAuthStatus(), restoreSession()])
      setAuthInitialized(status.initialized)
      if (restoredUser) {
        store.setApiMode(true, restoredUser)
        setAuthState('authenticated')
        void store.hydrateFromApi()
      } else {
        store.setApiMode(false)
        setAuthState('unauthenticated')
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to connect to the TMAS Reach API server.'
      )
      setAuthState('unauthenticated')
    }
  }, [isApiConfigured])

  useEffect(() => {
    if (!isApiConfigured) return
    const timer = setTimeout(() => {
      void bootstrapAuthSession()
    }, 0)

    const unsubUnauthorized = apiClient.onUnauthorized(() => {
      logoutSession()
      store.setApiMode(false)
      setAuthState('unauthenticated')
      addToast('error', 'Your session expired. Please sign in again.')
    })

    return () => {
      clearTimeout(timer)
      unsubUnauthorized()
    }
  }, [isApiConfigured, bootstrapAuthSession, addToast])

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

  useEffect(() => {
    const unsubStorage = store.subscribeStorageError((msg) => {
      addToast('error', msg)
    })
    return () => unsubStorage()
  }, [addToast])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeTab === 'unsubscribe' && url.pathname.startsWith('/unsubscribe/')) {
      return
    }
    if (activeTab !== 'unsubscribe' && url.pathname.startsWith('/unsubscribe/')) {
      url.pathname = '/'
    }
    if (url.searchParams.get('tab') !== activeTab) {
      url.searchParams.set('tab', activeTab)
      if (activeTab !== 'unsubscribe') {
        url.searchParams.delete('token')
      }
      window.history.replaceState(null, '', url.toString())
    }
  }, [activeTab])

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(readTabFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (isApiConfigured && authState !== 'authenticated') return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowPalette((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isApiConfigured, authState])

  const pendingApprovalsCount = useMemo(
    () => campaigns.filter((c) => c.status === 'pending_approval').length,
    [campaigns]
  )
  const pendingSurveysCount = useMemo(
    () => surveys.filter((s) => s.status === 'pending_review').length,
    [surveys]
  )

  const handleSelectTab = useCallback(
    (tab: TabKey) => {
      if (tab === 'admin' && currentUser.role !== 'administrator') {
        addToast('error', 'Administrator role is required to access Team & RBAC.')
        return
      }
      setActiveTab(tab)
    },
    [currentUser.role, addToast]
  )

  const handleRoleChange = (role: UserRole) => {
    store.setCurrentRole(role)
    addToast('info', `Active role switched to ${role.replace('_', ' ')}`)
    if (role !== 'administrator' && activeTab === 'admin') {
      setActiveTab('contacts')
    }
  }

  const handleAuthenticated = (user: User, isBootstrap: boolean) => {
    setAuthInitialized(true)
    setAuthError(null)
    store.setApiMode(true, user)
    setAuthState('authenticated')
    if (user.role !== 'administrator' && activeTab === 'admin') {
      setActiveTab('contacts')
    }
    void store.hydrateFromApi()
    addToast(
      'success',
      isBootstrap ? 'Administrator account created.' : `Signed in as ${user.full_name}.`
    )
  }

  const handleSignOut = () => {
    logoutSession()
    store.setApiMode(false)
    setAuthState('unauthenticated')
    setActiveTab('contacts')
    addToast('info', 'Signed out.')
  }

  const handleResetConfirmed = () => {
    store.resetToDefault()
    setShowResetConfirm(false)
    addToast('info', 'Demo data restored to defaults')
  }

  if (isApiConfigured && authState !== 'authenticated') {
    if (activeTab === 'unsubscribe') {
      return (
        <div className="min-h-screen bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <UnsubscribePortal
            contacts={contacts}
            onBack={() => setActiveTab('contacts')}
            backLabel="Back to Sign In"
          />
          <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
      )
    }

    if (authState === 'checking') {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
            <span>Connecting to TMAS Reach API...</span>
          </div>
        </div>
      )
    }

    if (authError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              API Server Unreachable
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">{authError}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void bootstrapAuthSession()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unsubscribe')}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Unsubscribe Portal
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        <LoginView
          initialized={authInitialized}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onAuthenticated={handleAuthenticated}
          onOpenUnsubscribe={() => setActiveTab('unsubscribe')}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col relative selection:bg-amber-400 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-radial from-amber-400/5 via-slate-500/5 to-transparent blur-3xl dark:from-amber-400/8 dark:via-slate-500/5" />
      </div>

      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        users={users}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenCommandPalette={() => setShowPalette(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        pendingSurveysCount={pendingSurveysCount}
        isApiMode={isApiMode}
        onSignOut={handleSignOut}
        onOpenChangePassword={() => setShowChangePassword(true)}
        onSyncNow={() => void store.hydrateFromApi()}
        onSelectUser={(userId) => {
          store.setCurrentUser(userId)
          const target = users.find((u) => u.id === userId)
          if (target) {
            addToast('info', `Switched active user to ${target.full_name} (${target.email})`)
            if (target.role !== 'administrator' && activeTab === 'admin') {
              setActiveTab('contacts')
            }
          }
        }}
        onRoleChange={handleRoleChange}
      />

      {storageError && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{storageError}</span>
            </div>
            <button
              type="button"
              onClick={() => store.clearStorageError()}
              aria-label="Dismiss storage warning"
              className="rounded p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7">
        <ErrorBoundary
          scope="Current View"
          resetKey={activeTab}
          onResetData={
            isApiMode
              ? undefined
              : () => {
                  store.resetToDefault()
                  addToast('info', 'Local data reset to defaults')
                }
          }
        >
          {activeTab === 'contacts' && (
            <ContactList
              contacts={contacts}
              campaigns={campaigns}
              userRole={currentUser.role}
              onToast={addToast}
            />
          )}

          {activeTab === 'intake' && <SurveyHub surveys={surveys} onToast={addToast} />}

          {activeTab === 'templates' && (
            <TemplateList templates={templates} onToast={addToast} />
          )}

          {activeTab === 'campaigns' && (
            <CampaignList
              campaigns={campaigns}
              templates={templates}
              contacts={contacts}
              userRole={currentUser.role}
              onToast={addToast}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              contacts={contacts}
              campaigns={campaigns}
              userRole={currentUser.role}
            />
          )}

          {activeTab === 'logs' && <ActivityLogs logs={logs} />}

          {activeTab === 'admin' && currentUser.role === 'administrator' && (
            <UserManagement
              users={users}
              currentUserId={currentUser.id}
              onToast={addToast}
            />
          )}

          {activeTab === 'unsubscribe' && (
            <UnsubscribePortal
              contacts={contacts}
              onBack={() => setActiveTab('contacts')}
            />
          )}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/60 py-3 text-xs text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <span>
            TMAS Reach · Signed in as{' '}
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              {currentUser.full_name}
            </strong>
          </span>
          {!isApiMode && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded"
            >
              Reset demo data
            </button>
          )}
        </div>
      </footer>

      <CommandPalette
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        onSelectTab={handleSelectTab}
        isAdmin={currentUser.role === 'administrator'}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onRequestReset={isApiMode ? undefined : () => setShowResetConfirm(true)}
        contacts={contacts}
        templates={templates}
        campaigns={campaigns}
      />

      {!isApiMode && (
        <ConfirmDialog
          isOpen={showResetConfirm}
          title="Reset local workspace data?"
          message="This will clear added contacts, campaigns, intake submissions, and custom templates, restoring the default seed state."
          confirmLabel="Reset data"
          tone="warning"
          onConfirm={handleResetConfirmed}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {isApiMode && (
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false)
            addToast('success', 'Password updated.')
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
