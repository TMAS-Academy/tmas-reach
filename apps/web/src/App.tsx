import { useState, useEffect, useCallback } from 'react'
import { store } from './lib/store'
import type { UserRole } from './types'
import { Navbar, type TabKey } from './components/layout/Navbar'
import { ToastContainer, type ToastMessage } from './components/ui/Toast'
import { ContactList } from './components/contacts/ContactList'
import { TemplateList } from './components/templates/TemplateList'
import { CampaignList } from './components/campaigns/CampaignList'
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard'
import { ActivityLogs } from './components/analytics/ActivityLogs'
import { UserManagement } from './components/admin/UserManagement'
import { UnsubscribePortal } from './components/unsubscribe/UnsubscribePortal'
import { SurveyHub } from './components/survey/SurveyHub'
import './App.css'

export default function App() {
  const [, setTick] = useState(0)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab') as TabKey | null
    return tabParam || 'contacts'
  })

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}-${Math.random()}`, type, text }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((t) => t + 1)
    })
    return () => unsubscribe()
  }, [])

  const currentUser = store.getCurrentUser()
  const contacts = store.getContacts()
  const templates = store.getTemplates()
  const campaigns = store.getCampaigns()
  const logs = store.getLogs()
  const users = store.getUsers()
  const surveys = store.getSurveys()

  const handleRoleChange = (role: UserRole) => {
    store.setCurrentRole(role)
    addToast('info', `Active role switched to ${role}`)
    if (role !== 'administrator' && activeTab === 'admin') {
      setActiveTab('contacts')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onRoleChange={handleRoleChange}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {activeTab === 'contacts' && (
          <ContactList
            contacts={contacts}
            campaigns={campaigns}
            userRole={currentUser.role}
          />
        )}

        {activeTab === 'intake' && (
          <SurveyHub surveys={surveys} onToast={addToast} />
        )}

        {activeTab === 'templates' && <TemplateList templates={templates} />}

        {activeTab === 'campaigns' && (
          <CampaignList
            campaigns={campaigns}
            templates={templates}
            contacts={contacts}
            userRole={currentUser.role}
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
          <UserManagement users={users} />
        )}

        {activeTab === 'unsubscribe' && (
          <UnsubscribePortal
            contacts={contacts}
            onBack={() => setActiveTab('contacts')}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TMAS Reach — Internal Outreach Platform for TMAS Academy</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                store.resetToDefault()
                addToast('success', 'Reset demo seed data')
              }}
              className="hover:underline text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Reset Demo Seed Data
            </button>
            <span>PostgreSQL / Supabase Schema Aligned</span>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
