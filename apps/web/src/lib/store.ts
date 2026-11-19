import type {
  ActivityLog,
  Campaign,
  CampaignRecipient,
  Contact,
  ContactStatus,
  EmailTemplate,
  User,
  UserRole,
} from '../types'
import type { SurveySubmission } from '../types/survey'
import { validateCampaignPreApproval } from './templateEngine'

export const MAX_ACTIVITY_LOGS = 500

const STORAGE_KEYS = {
  users: 'tmas_users',
  contacts: 'tmas_contacts',
  templates: 'tmas_templates',
  campaigns: 'tmas_campaigns',
  recipients: 'tmas_recipients',
  logs: 'tmas_logs',
  surveys: 'tmas_surveys',
} as const

const STORAGE_KEY_SET = new Set<string>(Object.values(STORAGE_KEYS))

export interface AppStoreSnapshot {
  readonly users: User[]
  readonly currentUser: User
  readonly contacts: Contact[]
  readonly templates: EmailTemplate[]
  readonly campaigns: Campaign[]
  readonly recipients: CampaignRecipient[]
  readonly logs: ActivityLog[]
  readonly surveys: SurveySubmission[]
  readonly storageError: string | null
}

function cloneData<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 12)}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

export function generateToken(prefix = 'tok'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, '')}`
  }
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 12)}`
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: number }
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  )
}

const SEED_USERS: User[] = [
  {
    id: 'usr-1',
    email: 'intern@example.com',
    full_name: 'Outreach Intern',
    role: 'marketing_intern',
    is_active: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-2',
    email: 'lead@example.com',
    full_name: 'Outreach Lead',
    role: 'marketing_lead',
    is_active: true,
    created_at: '2026-08-15T08:00:00Z',
    updated_at: '2026-08-15T08:00:00Z',
  },
  {
    id: 'usr-3',
    email: 'admin@example.com',
    full_name: 'Administrator',
    role: 'administrator',
    is_active: true,
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-01T08:00:00Z',
  },
]

const SEED_CONTACTS: Contact[] = []

const SEED_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Fall Mathematics Outreach - School Leaders',
    subject_template: 'Partnering with TMAS Academy for STEM success at {{organization}}',
    body_html: `<p>Dear {{first_name}},</p>
<p>We hope this semester is going well at {{organization}}. As {{job_role}}, we wanted to reach out regarding TMAS Academy's competitive mathematics and STEM enrichment programs.</p>
<p>We are offering complimentary workshops and student resource packs for schools in your district.</p>
<p>Best regards,<br>The TMAS Academy Team</p>
<hr/>
<p style="font-size: 12px; color: #666;">
  If you no longer wish to receive outreach from TMAS Academy, you may <a href="{{unsubscribe_url}}">unsubscribe here</a>.
</p>`,
    body_text: `Dear {{first_name}},

We hope this semester is going well at {{organization}}. As {{job_role}}, we wanted to reach out regarding TMAS Academy's competitive mathematics and STEM enrichment programs.

We are offering complimentary workshops and student resource packs for schools in your district.

Best regards,
The TMAS Academy Team

---
Unsubscribe: {{unsubscribe_url}}`,
    created_by: 'usr-1',
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  },
  {
    id: 'tpl-2',
    name: 'District STEM Leadership Introduction',
    subject_template: 'TMAS Academy curriculum partnerships for {{organization}}',
    body_html: `<p>Hello {{first_name}},</p>
<p>We work with district leaders to elevate STEM achievement through extracurricular competition pathways.</p>
<p>Would you have 15 minutes next week to discuss curriculum support for your schools?</p>
<p>Warm regards,<br>TMAS Academy Outreach</p>
<hr/>
<p style="font-size: 12px; color: #666;">
  Opt out of these communications: <a href="{{unsubscribe_url}}">Unsubscribe</a>.
</p>`,
    body_text: `Hello {{first_name}},

We work with district leaders to elevate STEM achievement through extracurricular competition pathways.

Would you have 15 minutes next week to discuss curriculum support for your schools?

Warm regards,
TMAS Academy Outreach

---
Unsubscribe: {{unsubscribe_url}}`,
    created_by: 'usr-2',
    created_at: '2026-10-10T15:00:00Z',
    updated_at: '2026-10-10T15:00:00Z',
  },
]

const SEED_CAMPAIGNS: Campaign[] = []

const SEED_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    actor_id: 'usr-3',
    actor_name: 'TMAS Administrator (administrator)',
    action: 'system_initialized',
    entity_type: 'system',
    metadata: { version: '1.0.0' },
    created_at: '2026-10-01T08:00:00Z',
  },
]

const DEFAULT_SERVER_SNAPSHOT: AppStoreSnapshot = Object.freeze({
  users: cloneData(SEED_USERS),
  currentUser: cloneData(SEED_USERS[0]),
  contacts: cloneData(SEED_CONTACTS),
  templates: cloneData(SEED_TEMPLATES),
  campaigns: cloneData(SEED_CAMPAIGNS),
  recipients: [],
  logs: cloneData(SEED_LOGS),
  surveys: [],
  storageError: null,
})

export class AppStore {
  private users: User[]
  private currentUser: User
  private contacts: Contact[]
  private templates: EmailTemplate[]
  private campaigns: Campaign[]
  private recipients: CampaignRecipient[]
  private logs: ActivityLog[]
  private surveys: SurveySubmission[]
  private storageError: string | null = null
  private listeners: Set<() => void> = new Set()
  private storageErrorListeners: Set<(message: string) => void> = new Set()
  private cachedSnapshot: AppStoreSnapshot | null = null
  private readonly boundStorageHandler: ((event: StorageEvent) => void) | null = null

  constructor() {
    this.users = this.loadOrSeed(STORAGE_KEYS.users, SEED_USERS)
    this.currentUser = this.users[0] ?? cloneData(SEED_USERS[0])
    this.contacts = this.loadOrSeed(STORAGE_KEYS.contacts, SEED_CONTACTS)
    this.templates = this.loadOrSeed(STORAGE_KEYS.templates, SEED_TEMPLATES)
    this.campaigns = this.loadOrSeed(STORAGE_KEYS.campaigns, SEED_CAMPAIGNS)
    this.recipients = this.loadOrSeed(STORAGE_KEYS.recipients, [])
    this.logs = this.loadOrSeed(STORAGE_KEYS.logs, SEED_LOGS).slice(0, MAX_ACTIVITY_LOGS)
    this.surveys = this.loadOrSeed(STORAGE_KEYS.surveys, [])

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.boundStorageHandler = (event: StorageEvent) => this.handleStorageEvent(event)
      window.addEventListener('storage', this.boundStorageHandler)
    }
  }

  public dispose() {
    if (
      this.boundStorageHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('storage', this.boundStorageHandler)
    }
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key !== null && !STORAGE_KEY_SET.has(event.key)) {
      return
    }
    const previousUserId = this.currentUser?.id
    this.users = this.loadOrSeed(STORAGE_KEYS.users, SEED_USERS)
    this.currentUser =
      this.users.find((u) => u.id === previousUserId) ??
      this.users[0] ??
      cloneData(SEED_USERS[0])
    this.contacts = this.loadOrSeed(STORAGE_KEYS.contacts, SEED_CONTACTS)
    this.templates = this.loadOrSeed(STORAGE_KEYS.templates, SEED_TEMPLATES)
    this.campaigns = this.loadOrSeed(STORAGE_KEYS.campaigns, SEED_CAMPAIGNS)
    this.recipients = this.loadOrSeed(STORAGE_KEYS.recipients, [])
    this.logs = this.loadOrSeed(STORAGE_KEYS.logs, SEED_LOGS).slice(0, MAX_ACTIVITY_LOGS)
    this.surveys = this.loadOrSeed(STORAGE_KEYS.surveys, [])
    this.invalidateAndNotify()
  }

  private loadOrSeed<T>(key: string, seed: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored) as T
      }
    } catch {
      // Local storage unavailable or corrupt
    }
    return cloneData(seed)
  }

  private writeToStorage() {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(this.users))
    localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(this.contacts))
    localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(this.templates))
    localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(this.campaigns))
    localStorage.setItem(STORAGE_KEYS.recipients, JSON.stringify(this.recipients))
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(this.logs))
    localStorage.setItem(STORAGE_KEYS.surveys, JSON.stringify(this.surveys))
  }

  private save() {
    let errorMessage: string | null = null
    try {
      this.writeToStorage()
    } catch (err) {
      if (isQuotaError(err)) {
        if (this.logs.length > 100) {
          this.logs = this.logs.slice(0, 100)
          try {
            this.writeToStorage()
          } catch {
            errorMessage =
              'Browser storage quota exceeded. Export your contacts or clear old data to keep saving changes.'
          }
        } else {
          errorMessage =
            'Browser storage quota exceeded. Export your contacts or clear old data to keep saving changes.'
        }
      } else {
        errorMessage = 'Unable to persist changes to local browser storage.'
      }
    }

    this.storageError = errorMessage
    if (errorMessage) {
      this.storageErrorListeners.forEach((listener) => listener(errorMessage))
    }
    this.invalidateAndNotify()
  }

  private invalidateAndNotify() {
    this.cachedSnapshot = null
    this.notify()
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public subscribeStorageError(listener: (message: string) => void): () => void {
    this.storageErrorListeners.add(listener)
    return () => {
      this.storageErrorListeners.delete(listener)
    }
  }

  public getStorageError(): string | null {
    return this.storageError
  }

  public clearStorageError() {
    if (this.storageError !== null) {
      this.storageError = null
      this.invalidateAndNotify()
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  public getSnapshot(): AppStoreSnapshot {
    if (!this.cachedSnapshot) {
      const sortedLogs = [...this.logs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const sortedSurveys = [...this.surveys].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )
      this.cachedSnapshot = Object.freeze({
        users: [...this.users],
        currentUser: { ...this.currentUser },
        contacts: [...this.contacts],
        templates: [...this.templates],
        campaigns: [...this.campaigns],
        recipients: [...this.recipients],
        logs: sortedLogs,
        surveys: sortedSurveys,
        storageError: this.storageError,
      })
    }
    return this.cachedSnapshot
  }

  public getServerSnapshot(): AppStoreSnapshot {
    return DEFAULT_SERVER_SNAPSHOT
  }

  public getUsers(): User[] {
    return [...this.users]
  }

  public getCurrentUser(): User {
    return { ...this.currentUser }
  }

  public setCurrentRole(role: UserRole) {
    const user = this.users.find((u) => u.role === role) || this.users[0]
    this.currentUser = user
    this.invalidateAndNotify()
  }

  public setCurrentUser(userId: string) {
    const user = this.users.find((u) => u.id === userId)
    if (user) {
      this.currentUser = user
      this.invalidateAndNotify()
    }
  }

  public addUser(data: {
    email: string
    full_name: string
    role: UserRole
  }): { success: boolean; user?: User; error?: string } {
    const emailNorm = data.email.trim().toLowerCase()
    if (!emailNorm) {
      return { success: false, error: 'Email address is required.' }
    }
    if (this.users.some((u) => u.email.toLowerCase() === emailNorm)) {
      return { success: false, error: `A team member with email "${emailNorm}" already exists.` }
    }

    const now = new Date().toISOString()
    const newUser: User = {
      id: generateId('usr'),
      email: emailNorm,
      full_name: data.full_name.trim() || emailNorm.split('@')[0],
      role: data.role,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    this.users = [...this.users, newUser]
    this.logActivity('user_created', 'user', newUser.id, { email: emailNorm, role: data.role })
    this.save()
    return { success: true, user: newUser }
  }

  public deleteUser(userId: string): { success: boolean; error?: string } {
    const user = this.users.find((u) => u.id === userId)
    if (!user) return { success: false, error: 'User not found.' }

    if (user.role === 'administrator') {
      const adminCount = this.users.filter((u) => u.role === 'administrator').length
      if (adminCount <= 1) {
        return { success: false, error: 'Cannot remove the last administrator.' }
      }
    }

    this.users = this.users.filter((u) => u.id !== userId)
    if (this.currentUser.id === userId) {
      this.currentUser = this.users[0]
    }

    this.logActivity('user_deleted', 'user', userId, { email: user.email })
    this.save()
    return { success: true }
  }

  public importUsers(rows: { email: string; full_name?: string; role?: UserRole }[]): {
    imported: number
    updated: number
  } {
    let imported = 0
    let updated = 0
    const now = new Date().toISOString()
    const nextUsers = this.users.map((u) => ({ ...u }))

    rows.forEach((row) => {
      const emailNorm = row.email.trim().toLowerCase()
      if (!emailNorm) return

      const existing = nextUsers.find((u) => u.email.toLowerCase() === emailNorm)
      if (existing) {
        let changed = false
        if (row.full_name && row.full_name !== existing.full_name) {
          existing.full_name = row.full_name
          changed = true
        }
        if (row.role && row.role !== existing.role) {
          existing.role = row.role
          changed = true
        }
        if (changed) {
          existing.updated_at = now
          updated++
        }
      } else {
        const newUser: User = {
          id: generateId('usr'),
          email: emailNorm,
          full_name: row.full_name?.trim() || emailNorm.split('@')[0],
          role: row.role || 'marketing_intern',
          is_active: true,
          created_at: now,
          updated_at: now,
        }
        nextUsers.push(newUser)
        imported++
      }
    })

    if (imported > 0 || updated > 0) {
      this.users = nextUsers
      const refreshedCurrent = this.users.find((u) => u.id === this.currentUser.id)
      if (refreshedCurrent) {
        this.currentUser = refreshedCurrent
      }
      this.logActivity('team_csv_imported', 'user', undefined, { imported, updated })
      this.save()
    }

    return { imported, updated }
  }

  public updateUserRole(userId: string, newRole: UserRole): { success: boolean; error?: string } {
    const target = this.users.find((u) => u.id === userId)
    if (!target) {
      return { success: false, error: 'User not found.' }
    }
    if (target.role === 'administrator' && newRole !== 'administrator') {
      const adminCount = this.users.filter((u) => u.role === 'administrator').length
      if (adminCount <= 1) {
        return { success: false, error: 'Cannot demote the last administrator.' }
      }
    }

    const now = new Date().toISOString()
    this.users = this.users.map((u) =>
      u.id === userId ? { ...u, role: newRole, updated_at: now } : u
    )
    if (this.currentUser.id === userId) {
      this.currentUser = { ...this.currentUser, role: newRole, updated_at: now }
    }
    this.logActivity('user_role_updated', 'user', userId, { newRole })
    this.save()
    return { success: true }
  }

  public getContacts(): Contact[] {
    return [...this.contacts]
  }

  public addContact(
    contactData: Omit<Contact, 'id' | 'unsubscribe_token' | 'created_at' | 'updated_at'>
  ): { success: boolean; error?: string } {
    const emailNorm = contactData.email.trim().toLowerCase()
    if (this.contacts.some((c) => c.email.toLowerCase() === emailNorm)) {
      return { success: false, error: `A contact with email "${emailNorm}" already exists.` }
    }

    const now = new Date().toISOString()
    const newContact: Contact = {
      ...contactData,
      id: generateId('cnt'),
      email: emailNorm,
      unsubscribe_token: generateToken('tok'),
      created_by: this.currentUser.id,
      created_at: now,
      updated_at: now,
    }

    this.contacts = [newContact, ...this.contacts]
    this.logActivity('contact_created', 'contact', newContact.id, { email: emailNorm })
    this.save()
    return { success: true }
  }

  public updateContact(id: string, updates: Partial<Contact>): { success: boolean; error?: string } {
    const contact = this.contacts.find((c) => c.id === id)
    if (!contact) {
      return { success: false, error: 'Contact not found' }
    }

    if (updates.email && updates.email.trim().toLowerCase() !== contact.email.toLowerCase()) {
      const emailNorm = updates.email.trim().toLowerCase()
      if (this.contacts.some((c) => c.id !== id && c.email.toLowerCase() === emailNorm)) {
        return { success: false, error: `Email "${emailNorm}" is already used by another contact.` }
      }
    }

    this.contacts = this.contacts.map((c) =>
      c.id === id
        ? {
            ...c,
            ...updates,
            updated_at: new Date().toISOString(),
          }
        : c
    )
    this.logActivity('contact_updated', 'contact', id, updates)
    this.save()
    return { success: true }
  }

  public setContactStatus(id: string, status: ContactStatus) {
    this.contacts = this.contacts.map((c) =>
      c.id === id ? { ...c, status, updated_at: new Date().toISOString() } : c
    )
    this.logActivity('contact_status_changed', 'contact', id, { status })
    this.save()
  }

  public deleteContact(id: string): { success: boolean } {
    const contact = this.contacts.find((c) => c.id === id)
    if (!contact) return { success: false }

    this.contacts = this.contacts.filter((c) => c.id !== id)
    this.recipients = this.recipients.filter((r) => r.contact_id !== id)
    this.logActivity('contact_deleted', 'contact', id, { email: contact.email })
    this.save()
    return { success: true }
  }

  public deleteContacts(ids: string[]): { count: number } {
    const idSet = new Set(ids)
    const initialCount = this.contacts.length
    this.contacts = this.contacts.filter((c) => !idSet.has(c.id))
    this.recipients = this.recipients.filter((r) => !idSet.has(r.contact_id))
    const deletedCount = initialCount - this.contacts.length
    if (deletedCount > 0) {
      this.logActivity('contacts_bulk_deleted', 'contact', undefined, { count: deletedCount })
      this.save()
    }
    return { count: deletedCount }
  }

  public importContacts(rows: Partial<Contact>[], allowEmptyUpdate = false): number {
    let importedCount = 0
    const now = new Date().toISOString()
    const nextContacts = this.contacts.map((c) => ({ ...c }))

    rows.forEach((row) => {
      if (!row.email) return
      const email = row.email.trim().toLowerCase()
      const existing = nextContacts.find((c) => c.email.toLowerCase() === email)

      if (existing) {
        if (allowEmptyUpdate && existing.status === 'active') {
          let updated = false
          const fields: (keyof Contact)[] = [
            'first_name',
            'last_name',
            'organization',
            'district',
            'job_role',
            'audience_tag',
          ]
          fields.forEach((f) => {
            if (row[f] && row[f] !== existing[f]) {
              ;(existing as unknown as Record<string, unknown>)[f] = row[f]
              updated = true
            }
          })
          if (updated) {
            existing.updated_at = now
            importedCount++
          }
        }
      } else {
        const newContact: Contact = {
          id: generateId('cnt'),
          email,
          first_name: row.first_name,
          last_name: row.last_name,
          organization: row.organization,
          district: row.district,
          job_role: row.job_role,
          audience_tag: row.audience_tag,
          status: 'active',
          unsubscribe_token: generateToken('tok'),
          created_by: this.currentUser.id,
          created_at: now,
          updated_at: now,
        }
        nextContacts.unshift(newContact)
        importedCount++
      }
    })

    this.contacts = nextContacts
    this.logActivity('csv_imported', 'contact', undefined, { count: importedCount })
    this.save()
    return importedCount
  }

  public getTemplates(): EmailTemplate[] {
    return [...this.templates]
  }

  public addTemplate(templateData: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString()
    const newTemplate: EmailTemplate = {
      ...templateData,
      id: generateId('tpl'),
      created_by: this.currentUser.id,
      created_at: now,
      updated_at: now,
    }
    this.templates = [newTemplate, ...this.templates]
    this.logActivity('template_created', 'template', newTemplate.id, { name: templateData.name })
    this.save()
    return newTemplate
  }

  public duplicateTemplate(templateId: string): {
    success: boolean
    template?: EmailTemplate
    error?: string
  } {
    const original = this.templates.find((t) => t.id === templateId)
    if (!original) return { success: false, error: 'Template not found' }

    const now = new Date().toISOString()
    const newTemplate: EmailTemplate = {
      id: generateId('tpl'),
      name: `${original.name} (Copy)`,
      subject_template: original.subject_template,
      body_html: original.body_html,
      body_text: original.body_text,
      created_by: this.currentUser.id,
      created_at: now,
      updated_at: now,
    }

    this.templates = [newTemplate, ...this.templates]
    this.logActivity('template_created', 'template', newTemplate.id, {
      duplicated_from: original.id,
    })
    this.save()
    return { success: true, template: newTemplate }
  }

  public updateTemplate(id: string, updates: Partial<EmailTemplate>) {
    this.templates = this.templates.map((t) =>
      t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    )
    this.logActivity('template_updated', 'template', id, updates)
    this.save()
  }

  public deleteTemplate(id: string): { success: boolean; error?: string } {
    const existing = this.templates.find((t) => t.id === id)
    if (!existing) {
      return { success: false, error: 'Template not found.' }
    }
    const activeUsage = this.campaigns.some(
      (c) =>
        c.template_id === id &&
        (c.status === 'pending_approval' || c.status === 'approved' || c.status === 'sending')
    )
    if (activeUsage) {
      return {
        success: false,
        error: 'Cannot delete a template currently used by an active or pending campaign.',
      }
    }
    this.templates = this.templates.filter((t) => t.id !== id)
    this.logActivity('template_deleted', 'template', id, { name: existing.name })
    this.save()
    return { success: true }
  }

  public getCampaigns(): Campaign[] {
    return [...this.campaigns]
  }

  public addCampaign(
    campaignData: Omit<Campaign, 'id' | 'status' | 'created_at' | 'updated_at'>
  ): Campaign {
    const now = new Date().toISOString()
    const newCampaign: Campaign = {
      ...campaignData,
      id: generateId('cmp'),
      status: 'draft',
      created_by: this.currentUser.id,
      created_at: now,
      updated_at: now,
    }
    this.campaigns = [newCampaign, ...this.campaigns]
    this.logActivity('campaign_created', 'campaign', newCampaign.id, { name: campaignData.name })
    this.save()
    return newCampaign
  }

  public updateCampaign(
    id: string,
    updates: Partial<Pick<Campaign, 'name' | 'template_id' | 'target_audience_tag' | 'batch_size'>>
  ): { success: boolean; error?: string } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (!campaign) {
      return { success: false, error: 'Campaign not found.' }
    }
    if (campaign.status !== 'draft' && campaign.status !== 'rejected') {
      return { success: false, error: 'Only draft or rejected campaigns can be edited.' }
    }
    this.campaigns = this.campaigns.map((c) =>
      c.id === id
        ? {
            ...c,
            ...updates,
            status: 'draft',
            updated_at: new Date().toISOString(),
          }
        : c
    )
    this.logActivity('campaign_updated', 'campaign', id, updates)
    this.save()
    return { success: true }
  }

  public reopenCampaign(id: string): { success: boolean; error?: string } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (!campaign) {
      return { success: false, error: 'Campaign not found.' }
    }
    if (campaign.status !== 'rejected') {
      return { success: false, error: 'Only rejected campaigns can be reopened to draft.' }
    }
    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, status: 'draft', updated_at: new Date().toISOString() } : c
    )
    this.logActivity('campaign_reopened', 'campaign', id)
    this.save()
    return { success: true }
  }

  public submitCampaign(id: string): { success: boolean; errors: string[] } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (!campaign) {
      return { success: false, errors: ['Campaign not found'] }
    }

    const template = this.templates.find((t) => t.id === campaign.template_id)
    if (!template) {
      return { success: false, errors: ['Associated template not found'] }
    }

    const activeContactsCount = this.contacts.filter(
      (c) =>
        c.status === 'active' &&
        (!campaign.target_audience_tag || c.audience_tag === campaign.target_audience_tag)
    ).length

    const validation = validateCampaignPreApproval(template, activeContactsCount)
    if (!validation.valid) {
      return { success: false, errors: validation.errors }
    }

    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, status: 'pending_approval', updated_at: new Date().toISOString() } : c
    )
    this.logActivity('campaign_submitted', 'campaign', id)
    this.save()
    return { success: true, errors: [] }
  }

  public reviewCampaign(
    id: string,
    decision: 'approved' | 'rejected',
    notes: string
  ): { success: boolean; error?: string } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    const now = new Date().toISOString()
    this.campaigns = this.campaigns.map((c) =>
      c.id === id
        ? {
            ...c,
            status: decision,
            reviewed_by: this.currentUser.id,
            reviewed_at: now,
            review_notes: notes,
            updated_at: now,
          }
        : c
    )

    if (decision === 'approved') {
      const eligibleContacts = this.contacts.filter(
        (c) =>
          c.status === 'active' &&
          (!campaign.target_audience_tag || c.audience_tag === campaign.target_audience_tag)
      )

      const newRecipients: CampaignRecipient[] = []
      eligibleContacts.forEach((contact) => {
        const alreadyQueued = this.recipients.some(
          (r) => r.campaign_id === campaign.id && r.contact_id === contact.id
        )
        if (!alreadyQueued) {
          newRecipients.push({
            id: generateId('rcp'),
            campaign_id: campaign.id,
            contact_id: contact.id,
            delivery_status: 'queued',
            created_at: now,
          })
        }
      })
      if (newRecipients.length > 0) {
        this.recipients = [...this.recipients, ...newRecipients]
      }
    }

    this.logActivity(
      decision === 'approved' ? 'campaign_approved' : 'campaign_rejected',
      'campaign',
      id,
      { review_notes: notes }
    )
    this.save()
    return { success: true }
  }

  public dispatchCampaignBatch(id: string): { sentCount: number; errors: string[] } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (
      !campaign ||
      (campaign.status !== 'approved' &&
        campaign.status !== 'sending' &&
        campaign.status !== 'completed')
    ) {
      return { sentCount: 0, errors: ['Campaign must be approved before dispatch.'] }
    }

    const template = this.templates.find((t) => t.id === campaign.template_id)
    if (!template) {
      return { sentCount: 0, errors: ['Associated template not found'] }
    }

    const now = new Date().toISOString()
    const nextRecipients = this.recipients.map((r) => ({ ...r }))
    const nextContacts = this.contacts.map((c) => ({ ...c }))
    const contactById = new Map(nextContacts.map((c) => [c.id, c]))

    const queuedRecipients = nextRecipients.filter(
      (r) => r.campaign_id === id && r.delivery_status === 'queued'
    )
    const batch = queuedRecipients.slice(0, campaign.batch_size || 50)
    let sentCount = 0

    batch.forEach((rcp) => {
      const contact = contactById.get(rcp.contact_id)
      if (!contact || contact.status !== 'active') {
        rcp.delivery_status = 'skipped_suppressed'
        return
      }

      const alreadyDelivered = nextRecipients.some(
        (other) =>
          other.campaign_id === id &&
          other.contact_id === rcp.contact_id &&
          other.delivery_status === 'delivered' &&
          other.id !== rcp.id
      )
      if (alreadyDelivered) {
        rcp.delivery_status = 'skipped_suppressed'
        return
      }

      rcp.delivery_status = 'delivered'
      rcp.provider_message_id = generateToken('resend').slice(0, 22)
      rcp.sent_at = now
      rcp.delivered_at = now
      contact.last_contacted_at = now
      sentCount++
    })

    const remainingQueued = nextRecipients.filter(
      (r) => r.campaign_id === id && r.delivery_status === 'queued'
    )
    const finalStatus = remainingQueued.length === 0 ? 'completed' : 'sending'

    this.recipients = nextRecipients
    this.contacts = nextContacts
    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, status: finalStatus, updated_at: now } : c
    )

    this.logActivity('batch_dispatched', 'campaign', id, { sentCount })
    this.save()
    return { sentCount, errors: [] }
  }

  public getAllRecipients(): CampaignRecipient[] {
    return [...this.recipients]
  }

  public getRecipientsForCampaign(campaignId: string): CampaignRecipient[] {
    return this.recipients.filter((r) => r.campaign_id === campaignId)
  }

  public enqueueRecipient(
    recipient: Omit<CampaignRecipient, 'created_at'> & { created_at?: string }
  ): CampaignRecipient {
    const entry: CampaignRecipient = {
      ...recipient,
      created_at: recipient.created_at ?? new Date().toISOString(),
    }
    this.recipients = [...this.recipients, entry]
    this.save()
    return entry
  }

  public simulateRecipientBounce(recipientId: string): { success: boolean } {
    const rcp = this.recipients.find((r) => r.id === recipientId)
    if (!rcp) return { success: false }

    const now = new Date().toISOString()
    this.recipients = this.recipients.map((r) =>
      r.id === recipientId ? { ...r, delivery_status: 'bounced', bounced_at: now } : r
    )

    const contact = this.contacts.find((c) => c.id === rcp.contact_id)
    if (contact) {
      this.contacts = this.contacts.map((c) =>
        c.id === rcp.contact_id ? { ...c, status: 'bounced', updated_at: now } : c
      )
    }

    this.logActivity('recipient_bounced', 'recipient', recipientId, {
      contact_id: rcp.contact_id,
      email: contact?.email,
    })
    this.save()
    return { success: true }
  }

  public unsubscribeContactByToken(token: string): { success: boolean; contact?: Contact } {
    const contact = this.contacts.find((c) => c.unsubscribe_token === token)
    if (!contact) {
      return { success: false }
    }

    const now = new Date().toISOString()
    const updatedContact: Contact = { ...contact, status: 'unsubscribed', updated_at: now }
    this.contacts = this.contacts.map((c) => (c.id === contact.id ? updatedContact : c))
    this.logActivity('contact_unsubscribed', 'contact', contact.id, { email: contact.email })
    this.save()
    return { success: true, contact: updatedContact }
  }

  public getLogs(): ActivityLog[] {
    return [...this.logs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  private logActivity(
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) {
    const nextLog: ActivityLog = {
      id: generateId('log'),
      actor_id: this.currentUser.id,
      actor_name: `${this.currentUser.full_name} (${this.currentUser.role})`,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: new Date().toISOString(),
    }
    this.logs = [nextLog, ...this.logs].slice(0, MAX_ACTIVITY_LOGS)
  }

  public getSurveys(): SurveySubmission[] {
    return [...this.surveys].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )
  }

  public addSurveySubmission(
    data: Omit<SurveySubmission, 'id' | 'status' | 'submitted_at'>
  ): SurveySubmission {
    const submission: SurveySubmission = {
      ...data,
      id: generateId('srv'),
      email: data.email.trim().toLowerCase(),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      organization: data.organization.trim(),
      job_role: data.job_role.trim(),
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
    }

    this.surveys = [submission, ...this.surveys]
    this.logActivity('survey_submitted', 'survey', submission.id, {
      organization: submission.organization,
      email: submission.email,
    })
    this.save()
    return submission
  }

  public promoteSurveyToContact(submissionId: string): { success: boolean; error?: string } {
    const submission = this.surveys.find((s) => s.id === submissionId)
    if (!submission) {
      return { success: false, error: 'Survey submission not found.' }
    }

    const districtValue = (submission as SurveySubmission & { district?: string }).district
    const res = this.addContact({
      email: submission.email,
      first_name: submission.first_name,
      last_name: submission.last_name,
      organization: submission.organization,
      district: districtValue,
      job_role: submission.job_role,
      audience_tag: submission.audience_tag,
      status: 'active',
    })

    if (!res.success) {
      return res
    }

    this.surveys = this.surveys.map((s) =>
      s.id === submissionId ? { ...s, status: 'imported_to_contacts' } : s
    )
    this.logActivity('survey_promoted_to_contact', 'survey', submissionId, {
      email: submission.email,
    })
    this.save()
    return { success: true }
  }

  public archiveSurvey(submissionId: string) {
    this.surveys = this.surveys.map((s) =>
      s.id === submissionId ? { ...s, status: 'archived' } : s
    )
    this.save()
  }

  public resetToDefault() {
    this.users = cloneData(SEED_USERS)
    this.currentUser = this.users[0]
    this.contacts = cloneData(SEED_CONTACTS)
    this.templates = cloneData(SEED_TEMPLATES)
    this.campaigns = cloneData(SEED_CAMPAIGNS)
    this.recipients = []
    this.logs = cloneData(SEED_LOGS)
    this.surveys = []
    this.storageError = null
    this.save()
  }
}

export const store = new AppStore()
