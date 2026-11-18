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

export class AppStore {
  private users: User[]
  private currentUser: User
  private contacts: Contact[]
  private templates: EmailTemplate[]
  private campaigns: Campaign[]
  private recipients: CampaignRecipient[]
  private logs: ActivityLog[]
  private surveys: SurveySubmission[]
  private listeners: (() => void)[] = []

  constructor() {
    this.users = this.loadOrSeed('tmas_users', SEED_USERS)
    this.currentUser = this.users[0]
    this.contacts = this.loadOrSeed('tmas_contacts', SEED_CONTACTS)
    this.templates = this.loadOrSeed('tmas_templates', SEED_TEMPLATES)
    this.campaigns = this.loadOrSeed('tmas_campaigns', SEED_CAMPAIGNS)
    this.recipients = this.loadOrSeed('tmas_recipients', [])
    this.logs = this.loadOrSeed('tmas_logs', SEED_LOGS)
    this.surveys = this.loadOrSeed('tmas_surveys', [])
  }

  private loadOrSeed<T>(key: string, seed: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Local storage unavailable or corrupt
    }
    return seed
  }

  private save() {
    try {
      localStorage.setItem('tmas_users', JSON.stringify(this.users))
      localStorage.setItem('tmas_contacts', JSON.stringify(this.contacts))
      localStorage.setItem('tmas_templates', JSON.stringify(this.templates))
      localStorage.setItem('tmas_campaigns', JSON.stringify(this.campaigns))
      localStorage.setItem('tmas_recipients', JSON.stringify(this.recipients))
      localStorage.setItem('tmas_logs', JSON.stringify(this.logs))
      localStorage.setItem('tmas_surveys', JSON.stringify(this.surveys))
    } catch {
      // Ignore storage errors
    }
    this.notify()
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
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
    this.notify()
  }

  public setCurrentUser(userId: string) {
    const user = this.users.find((u) => u.id === userId)
    if (user) {
      this.currentUser = user
      this.notify()
    }
  }

  public addUser(data: { email: string; full_name: string; role: UserRole }): { success: boolean; user?: User; error?: string } {
    const emailNorm = data.email.trim().toLowerCase()
    if (!emailNorm) {
      return { success: false, error: 'Email address is required.' }
    }
    if (this.users.some((u) => u.email.toLowerCase() === emailNorm)) {
      return { success: false, error: `A team member with email "${emailNorm}" already exists.` }
    }

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: emailNorm,
      full_name: data.full_name.trim() || emailNorm.split('@')[0],
      role: data.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.users.push(newUser)
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

  public importUsers(rows: { email: string; full_name?: string; role?: UserRole }[]): { imported: number; updated: number } {
    let imported = 0
    let updated = 0
    const now = new Date().toISOString()

    rows.forEach((row) => {
      const emailNorm = row.email.trim().toLowerCase()
      if (!emailNorm) return

      const existing = this.users.find((u) => u.email.toLowerCase() === emailNorm)
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
          id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          email: emailNorm,
          full_name: row.full_name?.trim() || emailNorm.split('@')[0],
          role: row.role || 'marketing_intern',
          is_active: true,
          created_at: now,
          updated_at: now,
        }
        this.users.push(newUser)
        imported++
      }
    })

    if (imported > 0 || updated > 0) {
      this.logActivity('team_csv_imported', 'user', undefined, { imported, updated })
      this.save()
    }

    return { imported, updated }
  }

  public updateUserRole(userId: string, newRole: UserRole) {
    this.users = this.users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    if (this.currentUser.id === userId) {
      this.currentUser.role = newRole
    }
    this.logActivity('user_role_updated', 'user', userId, { newRole })
    this.save()
  }

  public getContacts(): Contact[] {
    return [...this.contacts]
  }

  public addContact(contactData: Omit<Contact, 'id' | 'unsubscribe_token' | 'created_at' | 'updated_at'>): { success: boolean; error?: string } {
    const emailNorm = contactData.email.trim().toLowerCase()
    if (this.contacts.some((c) => c.email.toLowerCase() === emailNorm)) {
      return { success: false, error: `A contact with email "${emailNorm}" already exists.` }
    }

    const newContact: Contact = {
      ...contactData,
      id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: emailNorm,
      unsubscribe_token: `tok-${Math.random().toString(36).substring(2, 10)}`,
      created_by: this.currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.contacts.unshift(newContact)
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

    rows.forEach((row) => {
      if (!row.email) return
      const email = row.email.trim().toLowerCase()
      const existing = this.contacts.find((c) => c.email.toLowerCase() === email)

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
          id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          email,
          first_name: row.first_name,
          last_name: row.last_name,
          organization: row.organization,
          district: row.district,
          job_role: row.job_role,
          audience_tag: row.audience_tag,
          status: 'active',
          unsubscribe_token: `tok-${Math.random().toString(36).substring(2, 10)}`,
          created_by: this.currentUser.id,
          created_at: now,
          updated_at: now,
        }
        this.contacts.unshift(newContact)
        importedCount++
      }
    })

    this.logActivity('csv_imported', 'contact', undefined, { count: importedCount })
    this.save()
    return importedCount
  }

  public getTemplates(): EmailTemplate[] {
    return [...this.templates]
  }

  public addTemplate(templateData: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) {
    const newTemplate: EmailTemplate = {
      ...templateData,
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_by: this.currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.templates.unshift(newTemplate)
    this.logActivity('template_created', 'template', newTemplate.id, { name: templateData.name })
    this.save()
    return newTemplate
  }

  public updateTemplate(id: string, updates: Partial<EmailTemplate>) {
    this.templates = this.templates.map((t) =>
      t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    )
    this.logActivity('template_updated', 'template', id, updates)
    this.save()
  }

  public getCampaigns(): Campaign[] {
    return [...this.campaigns]
  }

  public addCampaign(campaignData: Omit<Campaign, 'id' | 'status' | 'created_at' | 'updated_at'>): Campaign {
    const newCampaign: Campaign = {
      ...campaignData,
      id: `cmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'draft',
      created_by: this.currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.campaigns.unshift(newCampaign)
    this.logActivity('campaign_created', 'campaign', newCampaign.id, { name: campaignData.name })
    this.save()
    return newCampaign
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

  public reviewCampaign(id: string, decision: 'approved' | 'rejected', notes: string): { success: boolean; error?: string } {
    const campaign = this.campaigns.find((c) => c.id === id)
    if (!campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    this.campaigns = this.campaigns.map((c) =>
      c.id === id
        ? {
            ...c,
            status: decision,
            reviewed_by: this.currentUser.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes,
            updated_at: new Date().toISOString(),
          }
        : c
    )

    if (decision === 'approved') {
      const eligibleContacts = this.contacts.filter(
        (c) =>
          c.status === 'active' &&
          (!campaign.target_audience_tag || c.audience_tag === campaign.target_audience_tag)
      )

      eligibleContacts.forEach((contact) => {
        const alreadyQueued = this.recipients.some(
          (r) => r.campaign_id === campaign.id && r.contact_id === contact.id
        )
        if (!alreadyQueued) {
          this.recipients.push({
            id: `rcp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            campaign_id: campaign.id,
            contact_id: contact.id,
            delivery_status: 'queued',
            created_at: new Date().toISOString(),
          })
        }
      })
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

    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, status: 'sending', updated_at: new Date().toISOString() } : c
    )

    const queuedRecipients = this.recipients.filter(
      (r) => r.campaign_id === id && r.delivery_status === 'queued'
    )
    const batch = queuedRecipients.slice(0, campaign.batch_size || 50)
    let sentCount = 0
    const now = new Date().toISOString()

    batch.forEach((rcp) => {
      const contact = this.contacts.find((c) => c.id === rcp.contact_id)
      if (!contact || contact.status !== 'active') {
        rcp.delivery_status = 'skipped_suppressed'
        return
      }

      const alreadyDelivered = this.recipients.some(
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
      rcp.provider_message_id = `resend_${Math.random().toString(36).substring(2, 12)}`
      rcp.sent_at = now
      rcp.delivered_at = now
      contact.last_contacted_at = now
      sentCount++
    })

    const remainingQueued = this.recipients.filter(
      (r) => r.campaign_id === id && r.delivery_status === 'queued'
    )
    const finalStatus = remainingQueued.length === 0 ? 'completed' : 'sending'

    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, status: finalStatus, updated_at: new Date().toISOString() } : c
    )

    this.logActivity('batch_dispatched', 'campaign', id, { sentCount })
    this.save()
    return { sentCount, errors: [] }
  }

  public getRecipientsForCampaign(campaignId: string): CampaignRecipient[] {
    return this.recipients.filter((r) => r.campaign_id === campaignId)
  }

  public simulateRecipientBounce(recipientId: string): { success: boolean } {
    const rcp = this.recipients.find((r) => r.id === recipientId)
    if (!rcp) return { success: false }

    rcp.delivery_status = 'bounced'
    rcp.bounced_at = new Date().toISOString()

    const contact = this.contacts.find((c) => c.id === rcp.contact_id)
    if (contact) {
      contact.status = 'bounced'
      contact.updated_at = new Date().toISOString()
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

    contact.status = 'unsubscribed'
    contact.updated_at = new Date().toISOString()
    this.logActivity('contact_unsubscribed', 'contact', contact.id, { email: contact.email })
    this.save()
    return { success: true, contact }
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
    this.logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: this.currentUser.id,
      actor_name: `${this.currentUser.full_name} (${this.currentUser.role})`,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: new Date().toISOString(),
    })
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
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: data.email.trim().toLowerCase(),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      organization: data.organization.trim(),
      job_role: data.job_role.trim(),
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
    }

    this.surveys.unshift(submission)
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

    const res = this.addContact({
      email: submission.email,
      first_name: submission.first_name,
      last_name: submission.last_name,
      organization: submission.organization,
      job_role: submission.job_role,
      audience_tag: submission.audience_tag,
      status: 'active',
    })

    if (!res.success) {
      return res
    }

    submission.status = 'imported_to_contacts'
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
    this.users = SEED_USERS
    this.currentUser = SEED_USERS[0]
    this.contacts = SEED_CONTACTS
    this.templates = SEED_TEMPLATES
    this.campaigns = SEED_CAMPAIGNS
    this.recipients = []
    this.logs = SEED_LOGS
    this.surveys = []
    this.save()
  }
}

export const store = new AppStore()
