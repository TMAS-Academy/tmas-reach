import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SqliteStore,
  closePersistence,
  initPersistence,
  syncPersistence,
} from '../lib/sqliteStore.js'
import { contactsDb } from '../routes/contacts.js'
import { campaignsDb, campaignRecipientsDb, templatesDb } from '../routes/campaigns.js'
import { surveysDb } from '../routes/surveys.js'
import { activityLogsDb, appendActivityLog } from '../routes/logs.js'
import { buildDefaultRouter, createServerApp } from '../server.js'

const tempDirs: string[] = []
const activeServers: http.Server[] = []

function makeTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmas-reach-sqlite-'))
  tempDirs.push(dir)
  return path.join(dir, 'reach.sqlite')
}

function listenOnEphemeralPort(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind ephemeral port'))
        return
      }
      resolve(addr.port)
    })
  })
}

beforeEach(() => {
  closePersistence()
  contactsDb.length = 0
  campaignsDb.length = 0
  campaignRecipientsDb.length = 0
  surveysDb.length = 0
  activityLogsDb.length = 0
})

afterEach(async () => {
  closePersistence()
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('SQLite WAL Persistence & Activity Log Route', () => {
  it('enables WAL mode and persists all tables across close and reopen', () => {
    const dbPath = makeTempDbPath()
    const store = initPersistence(dbPath)!

    expect(store.getJournalMode()).toBe('wal')

    const now = new Date().toISOString()
    contactsDb.push({
      id: 'cnt_wal_1',
      email: 'principal@school.edu',
      first_name: 'Ada',
      last_name: 'Lovelace',
      organization: 'Oak Ridge High',
      job_role: 'Principal',
      audience_tag: 'high_school',
      status: 'active',
      unsubscribe_token: 'tok_wal_1',
      created_by: 'usr_lead',
      created_at: now,
      updated_at: now,
    })

    campaignsDb.push({
      id: 'cmp_wal_1',
      name: 'Fall Outreach',
      template_id: templatesDb[0].id,
      target_audience_tag: 'high_school',
      status: 'approved',
      batch_size: 25,
      created_by: 'usr_intern',
      reviewed_by: 'usr_lead',
      review_notes: 'Looks good',
      created_at: now,
      updated_at: now,
    })

    const retryAt = new Date(Date.now() + 60_000).toISOString()
    campaignRecipientsDb.push({
      id: 'rcp_wal_1',
      campaign_id: 'cmp_wal_1',
      contact_id: 'cnt_wal_1',
      email: 'principal@school.edu',
      personalized_subject: 'Hello',
      personalized_body: 'Body',
      delivery_status: 'queued',
      provider_message_id: 're_msg_wal_1',
      error_message: 'Rate limited',
      retry_count: 2,
      next_retry_at: retryAt,
    })

    surveysDb.push({
      id: 'srv_wal_1',
      email: 'teacher@school.edu',
      first_name: 'Grace',
      last_name: 'Hopper',
      organization: 'Oak Ridge High',
      job_role: 'Teacher',
      audience_tag: 'educators',
      grade_levels: ['9-12'],
      estimated_students: 120,
      notes: 'Interested in math club',
      consent_outreach: true,
      status: 'pending_review',
      submitted_at: now,
    })

    appendActivityLog({
      actor_id: 'usr_lead',
      action: 'campaign.approved',
      entity_type: 'campaign',
      entity_id: 'cmp_wal_1',
      metadata: { batch_size: 25 },
    })

    expect(store.recordProcessedWebhook('evt_1', 'delivered')).toBe(true)
    expect(store.recordProcessedWebhook('evt_1', 'delivered')).toBe(false)
    expect(store.hasProcessedWebhook('evt_1')).toBe(true)

    syncPersistence()
    closePersistence()

    // Clear in-memory stores to prove hydration reads from disk
    contactsDb.length = 0
    campaignsDb.length = 0
    campaignRecipientsDb.length = 0
    surveysDb.length = 0
    activityLogsDb.length = 0

    const reopened = initPersistence(dbPath)!
    expect(contactsDb).toHaveLength(1)
    expect(contactsDb[0].email).toBe('principal@school.edu')
    expect(campaignsDb).toHaveLength(1)
    expect(campaignsDb[0].reviewed_by).toBe('usr_lead')
    expect(campaignRecipientsDb).toHaveLength(1)
    expect(campaignRecipientsDb[0].provider_message_id).toBe('re_msg_wal_1')
    expect(campaignRecipientsDb[0].error_message).toBe('Rate limited')
    expect(campaignRecipientsDb[0].retry_count).toBe(2)
    expect(campaignRecipientsDb[0].next_retry_at).toBe(retryAt)
    expect(surveysDb).toHaveLength(1)
    expect(surveysDb[0].grade_levels).toEqual(['9-12'])
    expect(activityLogsDb).toHaveLength(1)
    expect(activityLogsDb[0].action).toBe('campaign.approved')
    expect(reopened.hasProcessedWebhook('evt_1')).toBe(true)
  })

  it('enforces UNIQUE(campaign_id, contact_id) constraint on campaign_recipients', () => {
    const store = new SqliteStore(':memory:')
    try {
      const stmt = store.db.prepare(
        `INSERT INTO campaign_recipients (
          id, campaign_id, contact_id, email, personalized_subject, personalized_body, delivery_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      stmt.run('rcp_a', 'cmp_1', 'cnt_1', 'a@school.edu', 'Subj', 'Body', 'queued')

      expect(() =>
        stmt.run('rcp_b', 'cmp_1', 'cnt_1', 'a@school.edu', 'Subj', 'Body', 'queued')
      ).toThrow(/UNIQUE constraint failed/i)
    } finally {
      store.close()
    }
  })

  it('requires auth on GET /api/logs and supports filtering and pagination', async () => {
    appendActivityLog({
      actor_id: 'usr_lead',
      action: 'campaign.approved',
      entity_type: 'campaign',
      entity_id: 'cmp_1',
    })
    appendActivityLog({
      actor_id: 'usr_intern',
      action: 'contact.created',
      entity_type: 'contact',
      entity_id: 'cnt_1',
    })

    const server = http.createServer(createServerApp(buildDefaultRouter()))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const unauth = await fetch(`http://127.0.0.1:${port}/api/logs`)
    expect(unauth.status).toBe(401)

    const filtered = await fetch(
      `http://127.0.0.1:${port}/api/logs?entity_type=campaign&page=1&limit=10`,
      {
        headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_intern' },
      }
    )
    expect(filtered.status).toBe(200)
    const body = (await filtered.json()) as {
      items: Array<{ action: string }>
      pagination: { total: number; page: number; limit: number }
    }
    expect(body.pagination.total).toBe(1)
    expect(body.items[0].action).toBe('campaign.approved')
  })
})
