import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { contactsDb, type ContactRecord, type ContactStatus } from '../routes/contacts.js'
import {
  campaignsDb,
  campaignRecipientsDb,
  templatesDb,
  type CampaignRecord,
  type CampaignRecipientRecord,
  type CampaignStatus,
  type EmailTemplateRecord,
} from '../routes/campaigns.js'
import { surveysDb, type SurveyRecord } from '../routes/surveys.js'
import { activityLogsDb, type ActivityLogRecord } from '../routes/logs.js'
import { usersDb, type UserRecord } from '../routes/auth.js'
import type { UserRole } from '../middleware/rbac.js'

export interface PersistenceSnapshot {
  users: UserRecord[]
  contacts: ContactRecord[]
  templates: EmailTemplateRecord[]
  campaigns: CampaignRecord[]
  recipients: CampaignRecipientRecord[]
  surveys: SurveyRecord[]
  activityLogs: ActivityLogRecord[]
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'marketing_intern',
  is_active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  organization TEXT,
  job_role TEXT,
  audience_tag TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  unsubscribe_token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_audience ON contacts(audience_tag);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  target_audience_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  batch_size INTEGER NOT NULL DEFAULT 50,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  email TEXT NOT NULL,
  personalized_subject TEXT NOT NULL,
  personalized_body TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  bounced_at TEXT,
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status ON campaign_recipients(campaign_id, delivery_status);

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization TEXT NOT NULL,
  job_role TEXT NOT NULL,
  audience_tag TEXT NOT NULL,
  grade_levels_json TEXT NOT NULL DEFAULT '[]',
  estimated_students INTEGER,
  notes TEXT,
  consent_outreach INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
`

export class SqliteStore {
  public readonly dbPath: string
  public readonly db: DatabaseSync
  private closed = false

  constructor(dbPath: string) {
    this.dbPath = dbPath
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
    }
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA synchronous = NORMAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA_SQL)
    this.runColumnMigrations()
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table});`).all() as Array<{ name?: string }>
    if (!columns.some((col) => col.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`)
    }
  }

  private runColumnMigrations(): void {
    this.ensureColumn('contacts', 'district', 'TEXT')
    this.ensureColumn('contacts', 'notes', 'TEXT')
    this.ensureColumn('contacts', 'last_contacted_at', 'TEXT')
    this.ensureColumn('surveys', 'district', 'TEXT')
    this.ensureColumn('campaigns', 'reviewed_at', 'TEXT')
    this.ensureColumn('campaign_recipients', 'created_at', 'TEXT')
    this.ensureColumn('activity_logs', 'actor_name', 'TEXT')
  }

  public getJournalMode(): string {
    const row = this.db.prepare('PRAGMA journal_mode;').get() as { journal_mode?: string } | undefined
    return (row?.journal_mode || '').toLowerCase()
  }

  public loadSnapshot(): PersistenceSnapshot {
    const userRows = this.db
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all() as Array<Record<string, unknown>>
    const users: UserRecord[] = userRows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      full_name: String(row.full_name),
      role: String(row.role) as UserRole,
      is_active: Boolean(row.is_active),
      password_hash: String(row.password_hash),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }))

    const contactRows = this.db
      .prepare('SELECT * FROM contacts ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>
    const contacts: ContactRecord[] = contactRows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      first_name: row.first_name ? String(row.first_name) : '',
      last_name: row.last_name ? String(row.last_name) : '',
      organization: row.organization ? String(row.organization) : '',
      job_role: row.job_role ? String(row.job_role) : '',
      audience_tag: row.audience_tag ? String(row.audience_tag) : 'educators',
      status: String(row.status) as ContactStatus,
      unsubscribe_token: String(row.unsubscribe_token),
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }))

    const templateRows = this.db
      .prepare('SELECT * FROM email_templates ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>
    const templates: EmailTemplateRecord[] = templateRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      subject_template: String(row.subject_template),
      body_html: row.body_html != null ? String(row.body_html) : undefined,
      body_text: row.body_text != null ? String(row.body_text) : undefined,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }))

    const campaignRows = this.db
      .prepare('SELECT * FROM campaigns ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>
    const campaigns: CampaignRecord[] = campaignRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      template_id: String(row.template_id),
      target_audience_tag: String(row.target_audience_tag),
      status: String(row.status) as CampaignStatus,
      scheduled_at: row.scheduled_at != null ? String(row.scheduled_at) : undefined,
      batch_size: Number(row.batch_size),
      created_by: String(row.created_by),
      reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : undefined,
      review_notes: row.review_notes != null ? String(row.review_notes) : undefined,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }))

    const recipientRows = this.db
      .prepare('SELECT * FROM campaign_recipients')
      .all() as Array<Record<string, unknown>>
    const recipients: CampaignRecipientRecord[] = recipientRows.map((row) => ({
      id: String(row.id),
      campaign_id: String(row.campaign_id),
      contact_id: String(row.contact_id),
      email: String(row.email),
      personalized_subject: String(row.personalized_subject),
      personalized_body: String(row.personalized_body),
      delivery_status: String(row.delivery_status) as CampaignRecipientRecord['delivery_status'],
      provider_message_id: row.provider_message_id != null ? String(row.provider_message_id) : undefined,
      error_message: row.error_message != null ? String(row.error_message) : undefined,
      retry_count: row.retry_count != null ? Number(row.retry_count) : 0,
      next_retry_at: row.next_retry_at != null ? String(row.next_retry_at) : undefined,
      sent_at: row.sent_at != null ? String(row.sent_at) : undefined,
      delivered_at: row.delivered_at != null ? String(row.delivered_at) : undefined,
      bounced_at: row.bounced_at != null ? String(row.bounced_at) : undefined,
    }))

    const surveyRows = this.db
      .prepare('SELECT * FROM surveys ORDER BY submitted_at DESC')
      .all() as Array<Record<string, unknown>>
    const surveys: SurveyRecord[] = surveyRows.map((row) => {
      let gradeLevels: string[] = []
      try {
        const parsed = JSON.parse(String(row.grade_levels_json || '[]'))
        if (Array.isArray(parsed)) gradeLevels = parsed.map(String)
      } catch {
        gradeLevels = []
      }
      return {
        id: String(row.id),
        email: String(row.email),
        first_name: String(row.first_name),
        last_name: String(row.last_name),
        organization: String(row.organization),
        job_role: String(row.job_role),
        audience_tag: String(row.audience_tag),
        grade_levels: gradeLevels,
        estimated_students: row.estimated_students != null ? Number(row.estimated_students) : undefined,
        notes: row.notes != null ? String(row.notes) : '',
        consent_outreach: Boolean(row.consent_outreach),
        status: String(row.status) as SurveyRecord['status'],
        submitted_at: String(row.submitted_at),
      }
    })

    const logRows = this.db
      .prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 2000')
      .all() as Array<Record<string, unknown>>
    const activityLogs: ActivityLogRecord[] = logRows.map((row) => {
      let metadata: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(String(row.metadata_json || '{}'))
        if (parsed && typeof parsed === 'object') metadata = parsed as Record<string, unknown>
      } catch {
        metadata = {}
      }
      return {
        id: String(row.id),
        actor_id: row.actor_id != null ? String(row.actor_id) : null,
        action: String(row.action),
        entity_type: String(row.entity_type),
        entity_id: row.entity_id != null ? String(row.entity_id) : null,
        metadata,
        created_at: String(row.created_at),
      }
    })

    return { users, contacts, templates, campaigns, recipients, surveys, activityLogs }
  }

  public hydrateInMemoryStores(): void {
    const snap = this.loadSnapshot()

    usersDb.splice(0, usersDb.length, ...snap.users)
    contactsDb.splice(0, contactsDb.length, ...snap.contacts)
    if (snap.templates.length > 0) {
      templatesDb.splice(0, templatesDb.length, ...snap.templates)
    }
    campaignsDb.splice(0, campaignsDb.length, ...snap.campaigns)
    campaignRecipientsDb.splice(0, campaignRecipientsDb.length, ...snap.recipients)
    surveysDb.splice(0, surveysDb.length, ...snap.surveys)
    activityLogsDb.splice(0, activityLogsDb.length, ...snap.activityLogs)
  }

  public syncFromInMemoryStores(): void {
    if (this.closed) return

    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.exec('DELETE FROM campaign_recipients')
      this.db.exec('DELETE FROM campaigns')
      this.db.exec('DELETE FROM email_templates')
      this.db.exec('DELETE FROM contacts')
      this.db.exec('DELETE FROM surveys')
      this.db.exec('DELETE FROM activity_logs')
      this.db.exec('DELETE FROM users')

      const insertUser = this.db.prepare(
        `INSERT INTO users (
          id, email, full_name, role, is_active, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const u of usersDb) {
        insertUser.run(
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.is_active ? 1 : 0,
          u.password_hash,
          u.created_at,
          u.updated_at
        )
      }

      const insertContact = this.db.prepare(
        `INSERT INTO contacts (
          id, email, first_name, last_name, organization, job_role,
          audience_tag, status, unsubscribe_token, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const c of contactsDb) {
        insertContact.run(
          c.id,
          c.email,
          c.first_name ?? '',
          c.last_name ?? '',
          c.organization ?? '',
          c.job_role ?? '',
          c.audience_tag ?? 'educators',
          c.status,
          c.unsubscribe_token,
          c.created_by,
          c.created_at,
          c.updated_at
        )
      }

      const insertTemplate = this.db.prepare(
        `INSERT INTO email_templates (
          id, name, subject_template, body_html, body_text, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const t of templatesDb) {
        insertTemplate.run(
          t.id,
          t.name,
          t.subject_template,
          t.body_html ?? null,
          t.body_text ?? null,
          t.created_by,
          t.created_at,
          t.updated_at
        )
      }

      const insertCampaign = this.db.prepare(
        `INSERT INTO campaigns (
          id, name, template_id, target_audience_tag, status, scheduled_at,
          batch_size, created_by, reviewed_by, review_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const cmp of campaignsDb) {
        insertCampaign.run(
          cmp.id,
          cmp.name,
          cmp.template_id,
          cmp.target_audience_tag,
          cmp.status,
          cmp.scheduled_at ?? null,
          cmp.batch_size,
          cmp.created_by,
          cmp.reviewed_by ?? null,
          cmp.review_notes ?? null,
          cmp.created_at,
          cmp.updated_at
        )
      }

      const insertRecipient = this.db.prepare(
        `INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, email, personalized_subject, personalized_body,
          delivery_status, provider_message_id, error_message, retry_count, next_retry_at,
          sent_at, delivered_at, bounced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(campaign_id, contact_id) DO UPDATE SET
          delivery_status = excluded.delivery_status,
          provider_message_id = excluded.provider_message_id,
          error_message = excluded.error_message,
          retry_count = excluded.retry_count,
          next_retry_at = excluded.next_retry_at,
          sent_at = excluded.sent_at,
          delivered_at = excluded.delivered_at,
          bounced_at = excluded.bounced_at`
      )
      for (const r of campaignRecipientsDb) {
        insertRecipient.run(
          r.id,
          r.campaign_id,
          r.contact_id,
          r.email,
          r.personalized_subject,
          r.personalized_body,
          r.delivery_status,
          r.provider_message_id ?? null,
          r.error_message ?? null,
          r.retry_count ?? 0,
          r.next_retry_at ?? null,
          r.sent_at ?? null,
          r.delivered_at ?? null,
          r.bounced_at ?? null
        )
      }

      const insertSurvey = this.db.prepare(
        `INSERT INTO surveys (
          id, email, first_name, last_name, organization, job_role, audience_tag,
          grade_levels_json, estimated_students, notes, consent_outreach, status, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const s of surveysDb) {
        insertSurvey.run(
          s.id,
          s.email,
          s.first_name,
          s.last_name,
          s.organization,
          s.job_role,
          s.audience_tag,
          JSON.stringify(s.grade_levels ?? []),
          s.estimated_students ?? null,
          s.notes ?? '',
          s.consent_outreach ? 1 : 0,
          s.status,
          s.submitted_at
        )
      }

      const insertLog = this.db.prepare(
        `INSERT INTO activity_logs (
          id, actor_id, action, entity_type, entity_id, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const log of activityLogsDb) {
        insertLog.run(
          log.id,
          log.actor_id,
          log.action,
          log.entity_type,
          log.entity_id ?? null,
          JSON.stringify(log.metadata ?? {}),
          log.created_at
        )
      }

      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  public hasProcessedWebhook(eventId: string): boolean {
    if (this.closed) return false
    const row = this.db
      .prepare('SELECT event_id FROM processed_webhooks WHERE event_id = ?')
      .get(eventId)
    return Boolean(row)
  }

  public recordProcessedWebhook(eventId: string, eventType: string, processedAt = new Date().toISOString()): boolean {
    if (this.closed) return false
    const result = this.db
      .prepare(
        'INSERT OR IGNORE INTO processed_webhooks (event_id, event_type, processed_at) VALUES (?, ?, ?)'
      )
      .run(eventId, eventType, processedAt)
    return Number(result.changes) > 0
  }

  public close(): void {
    if (this.closed) return
    this.closed = true
    this.db.close()
  }
}

let activeStore: SqliteStore | null = null

export function getActiveStore(): SqliteStore | null {
  return activeStore
}

export function initPersistence(dbPath?: string): SqliteStore | null {
  if (activeStore) {
    activeStore.close()
    activeStore = null
  }
  if (!dbPath) return null

  const store = new SqliteStore(dbPath)
  store.hydrateInMemoryStores()
  activeStore = store
  return store
}

export function syncPersistence(): void {
  activeStore?.syncFromInMemoryStores()
}

export function closePersistence(): void {
  if (!activeStore) return
  try {
    activeStore.syncFromInMemoryStores()
  } finally {
    activeStore.close()
    activeStore = null
  }
}
