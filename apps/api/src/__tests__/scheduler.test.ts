import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  TokenBucketRateLimiter,
  runBatchSchedulerTick,
  startBatchSchedulerLoop,
  stopBatchSchedulerLoop,
  type EmailSenderClient,
} from '../services/batchScheduler.js'
import {
  campaignsDb,
  campaignRecipientsDb,
  templatesDb,
  type CampaignRecord,
} from '../routes/campaigns.js'
import { contactsDb } from '../routes/contacts.js'
import { buildDefaultRouter, createServerApp } from '../server.js'

const activeServers: http.Server[] = []

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

beforeEach(async () => {
  await stopBatchSchedulerLoop()
  campaignsDb.length = 0
  campaignRecipientsDb.length = 0
  contactsDb.length = 0
})

afterEach(async () => {
  await stopBatchSchedulerLoop()
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
})

describe('Batch Scheduler Worker', () => {
  it('respects batch size, passes idempotency keys, and dispatches queued recipients incrementally', async () => {
    const campaign: CampaignRecord = {
      id: 'cmp_batch_test',
      name: 'Spring Calculus Invitational',
      template_id: 'tmpl_1',
      target_audience_tag: 'high_school',
      status: 'approved',
      batch_size: 2,
      created_by: 'usr_admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    campaignsDb.push(campaign)

    for (let i = 1; i <= 5; i++) {
      campaignRecipientsDb.push({
        id: `rcp_${i}`,
        campaign_id: campaign.id,
        contact_id: `cnt_${i}`,
        email: `math.teacher${i}@school.edu`,
        personalized_subject: `Invitational for School ${i}`,
        personalized_body: `Hello Teacher ${i}`,
        delivery_status: 'queued',
      })
    }

    const sentEmails: string[] = []
    const idempotencyKeys: string[] = []
    const mockSender: EmailSenderClient = {
      async sendEmail(to, _subject, _body, options) {
        sentEmails.push(to)
        if (options?.idempotencyKey) idempotencyKeys.push(options.idempotencyKey)
        return { success: true, messageId: `msg_${to}` }
      },
    }

    // Tick 1: sends batch_size (2) recipients
    const res1 = await runBatchSchedulerTick(mockSender)
    expect(res1.campaignsProcessed).toBe(1)
    expect(res1.emailsSent).toBe(2)
    expect(campaign.status).toBe('sending')
    expect(sentEmails).toHaveLength(2)
    expect(idempotencyKeys).toEqual(['cmp_batch_test:rcp_1', 'cmp_batch_test:rcp_2'])

    // Tick 2: sends next 2 recipients
    const res2 = await runBatchSchedulerTick(mockSender)
    expect(res2.emailsSent).toBe(2)
    expect(campaign.status).toBe('sending')
    expect(sentEmails).toHaveLength(4)

    // Tick 3: sends final 1 recipient and completes campaign
    const res3 = await runBatchSchedulerTick(mockSender)
    expect(res3.emailsSent).toBe(1)
    expect(campaign.status).toBe('completed')
    expect(res3.completedCampaigns).toContain(campaign.id)
    expect(sentEmails).toHaveLength(5)
  })

  it('skips campaigns scheduled for the future', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
    const futureCampaign: CampaignRecord = {
      id: 'cmp_future',
      name: 'Future Launch',
      template_id: 'tmpl_1',
      target_audience_tag: 'high_school',
      status: 'approved',
      scheduled_at: futureDate,
      batch_size: 10,
      created_by: 'usr_admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    campaignsDb.push(futureCampaign)

    campaignRecipientsDb.push({
      id: 'rcp_future_1',
      campaign_id: futureCampaign.id,
      contact_id: 'cnt_1',
      email: 'teacher@school.edu',
      personalized_subject: 'Future',
      personalized_body: 'Future',
      delivery_status: 'queued',
    })

    const res = await runBatchSchedulerTick()
    expect(res.campaignsProcessed).toBe(0)
    expect(res.emailsSent).toBe(0)
    expect(futureCampaign.status).toBe('approved')
  })

  it('re-checks contactsDb suppression status and prevents duplicate sends before dispatch', async () => {
    const now = new Date().toISOString()
    contactsDb.push(
      {
        id: 'cnt_active',
        email: 'active@school.edu',
        status: 'active',
        unsubscribe_token: 'tok_a',
        created_by: 'usr_1',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'cnt_unsub',
        email: 'opted.out@school.edu',
        status: 'unsubscribed',
        unsubscribe_token: 'tok_u',
        created_by: 'usr_1',
        created_at: now,
        updated_at: now,
      }
    )

    campaignsDb.push({
      id: 'cmp_sup',
      name: 'Suppression Check',
      template_id: 'tmpl_1',
      target_audience_tag: 'all',
      status: 'approved',
      batch_size: 10,
      created_by: 'usr_1',
      created_at: now,
      updated_at: now,
    })

    campaignRecipientsDb.push(
      {
        id: 'rcp_active_1',
        campaign_id: 'cmp_sup',
        contact_id: 'cnt_active',
        email: 'active@school.edu',
        personalized_subject: 'Hi',
        personalized_body: 'Body',
        delivery_status: 'queued',
      },
      {
        id: 'rcp_active_dup',
        campaign_id: 'cmp_sup',
        contact_id: 'cnt_active',
        email: 'active@school.edu',
        personalized_subject: 'Hi',
        personalized_body: 'Body',
        delivery_status: 'queued',
      },
      {
        id: 'rcp_unsub',
        campaign_id: 'cmp_sup',
        contact_id: 'cnt_unsub',
        email: 'opted.out@school.edu',
        personalized_subject: 'Hi',
        personalized_body: 'Body',
        delivery_status: 'queued',
      }
    )

    const sentTo: string[] = []
    const res = await runBatchSchedulerTick({
      async sendEmail(to) {
        sentTo.push(to)
        return { success: true, messageId: `msg_${sentTo.length}` }
      },
    })

    expect(res.emailsSent).toBe(1)
    expect(res.skippedSuppressed).toBe(2)
    expect(sentTo).toEqual(['active@school.edu'])
    expect(campaignRecipientsDb[1].delivery_status).toBe('skipped_suppressed')
    expect(campaignRecipientsDb[2].delivery_status).toBe('skipped_suppressed')
  })

  it('prevents overlapping concurrent ticks with a concurrency lock', async () => {
    const now = new Date().toISOString()
    campaignsDb.push({
      id: 'cmp_lock',
      name: 'Concurrency Lock Test',
      template_id: 'tmpl_1',
      target_audience_tag: 'all',
      status: 'approved',
      batch_size: 5,
      created_by: 'usr_1',
      created_at: now,
      updated_at: now,
    })
    campaignRecipientsDb.push({
      id: 'rcp_lock_1',
      campaign_id: 'cmp_lock',
      contact_id: 'cnt_lock_1',
      email: 'lock@school.edu',
      personalized_subject: 'Hi',
      personalized_body: 'Body',
      delivery_status: 'queued',
    })

    let releaseSend!: () => void
    const sendBlocked = new Promise<void>((resolve) => {
      releaseSend = resolve
    })

    let calls = 0
    const slowSender: EmailSenderClient = {
      async sendEmail() {
        calls++
        await sendBlocked
        return { success: true, messageId: 'msg_1' }
      },
    }

    const firstTick = runBatchSchedulerTick(slowSender)
    const overlappingTick = await runBatchSchedulerTick(slowSender)
    expect(overlappingTick.skippedDueToLock).toBe(true)
    expect(overlappingTick.emailsSent).toBe(0)

    releaseSend()
    const firstResult = await firstTick
    expect(firstResult.emailsSent).toBe(1)
    expect(calls).toBe(1)
  })

  it('retries transient failures with backoff and transitions to terminal failed after maxRetries or permanent 4xx', async () => {
    let fakeNow = Date.UTC(2026, 5, 1, 12, 0, 0)
    const nowIso = new Date(fakeNow).toISOString()

    campaignsDb.push({
      id: 'cmp_retry',
      name: 'Retry Test',
      template_id: 'tmpl_1',
      target_audience_tag: 'all',
      status: 'approved',
      batch_size: 10,
      created_by: 'usr_1',
      created_at: nowIso,
      updated_at: nowIso,
    })

    campaignRecipientsDb.push(
      {
        id: 'rcp_transient',
        campaign_id: 'cmp_retry',
        contact_id: 'cnt_t',
        email: 'transient@school.edu',
        personalized_subject: 'Hi',
        personalized_body: 'Body',
        delivery_status: 'queued',
      },
      {
        id: 'rcp_permanent',
        campaign_id: 'cmp_retry',
        contact_id: 'cnt_p',
        email: 'permanent@school.edu',
        personalized_subject: 'Hi',
        personalized_body: 'Body',
        delivery_status: 'queued',
      }
    )

    const failingSender: EmailSenderClient = {
      async sendEmail(to) {
        if (to === 'permanent@school.edu') {
          return { success: false, statusCode: 422, retryable: false, error: 'Invalid address' }
        }
        return { success: false, statusCode: 429, retryable: true, retryAfterMs: 2000, error: 'Rate limited' }
      },
    }

    // Attempt 1: permanent fails immediately; transient schedules retry in 2s
    const t1 = await runBatchSchedulerTick(failingSender, {
      maxRetries: 2,
      now: () => fakeNow,
      random: () => 0.5,
    })
    expect(t1.failedCount).toBe(1)
    expect(t1.retriedCount).toBe(1)
    expect(campaignRecipientsDb[1].delivery_status).toBe('failed')
    expect(campaignRecipientsDb[0].delivery_status).toBe('queued')
    expect(campaignsDb[0].status).toBe('sending')

    // Too early (only 1s elapsed): transient recipient is skipped until backoff expires
    fakeNow += 1000
    const tEarly = await runBatchSchedulerTick(failingSender, {
      maxRetries: 2,
      now: () => fakeNow,
      random: () => 0.5,
    })
    expect(tEarly.errorsCount).toBe(0)
    expect(campaignRecipientsDb[0].delivery_status).toBe('queued')

    // After backoff expires (total +2.5s): attempt 2 hits maxRetries -> terminal failed, campaign completes
    fakeNow += 1500
    const t2 = await runBatchSchedulerTick(failingSender, {
      maxRetries: 2,
      now: () => fakeNow,
      random: () => 0.5,
    })
    expect(t2.failedCount).toBe(1)
    expect(campaignRecipientsDb[0].delivery_status).toBe('failed')
    expect(campaignsDb[0].status).toBe('completed')
  })

  it('throttles sends via TokenBucketRateLimiter when exceeding rate limit', async () => {
    let fakeNow = 1_000_000
    const sleeps: number[] = []
    const limiter = new TokenBucketRateLimiter(2, {
      now: () => fakeNow,
      sleep: async (ms) => {
        sleeps.push(ms)
        fakeNow += ms
      },
    })

    // First 2 tokens are immediate (burst capacity = 2)
    await limiter.acquire()
    await limiter.acquire()
    expect(sleeps).toHaveLength(0)

    // 3rd token requires waiting ~500ms at 2 req/s
    await limiter.acquire()
    expect(sleeps).toEqual([500])
  })

  it('exposes POST /api/campaigns/:id/dispatch with marketing_lead RBAC and approval gate, plus background loop stop', async () => {
    const server = http.createServer(createServerApp(buildDefaultRouter()))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)
    const baseUrl = `http://127.0.0.1:${port}`

    const now = new Date().toISOString()
    contactsDb.push({
      id: 'cnt_disp_1',
      email: 'dispatch@school.edu',
      first_name: 'Lin',
      organization: 'Central High',
      audience_tag: 'high_school',
      status: 'active',
      unsubscribe_token: 'tok_disp_1',
      created_by: 'usr_i',
      created_at: now,
      updated_at: now,
    })

    const draftCmp: CampaignRecord = {
      id: 'cmp_dispatch_1',
      name: 'Manual Dispatch Test',
      template_id: templatesDb[0].id,
      target_audience_tag: 'high_school',
      status: 'draft',
      batch_size: 10,
      created_by: 'usr_i',
      created_at: now,
      updated_at: now,
    }
    campaignsDb.push(draftCmp)

    // Intern forbidden
    const internRes = await fetch(`${baseUrl}/api/campaigns/${draftCmp.id}/dispatch`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    expect(internRes.status).toBe(403)

    // Draft campaign blocked by approval gate
    const draftRes = await fetch(`${baseUrl}/api/campaigns/${draftCmp.id}/dispatch`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
    })
    expect(draftRes.status).toBe(400)

    // Submit -> approve -> dispatch succeeds
    await fetch(`${baseUrl}/api/campaigns/${draftCmp.id}/submit`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    await fetch(`${baseUrl}/api/campaigns/${draftCmp.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
      body: JSON.stringify({ action: 'approve' }),
    })

    const dispatchRes = await fetch(`${baseUrl}/api/campaigns/${draftCmp.id}/dispatch`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
    })
    expect(dispatchRes.status).toBe(200)
    const body = (await dispatchRes.json()) as {
      campaign: { status: string }
      dispatch: { emailsSent: number }
    }
    expect(body.dispatch.emailsSent).toBe(1)
    expect(body.campaign.status).toBe('completed')

    // Start & stop scheduler loop cleanly
    const timer = startBatchSchedulerLoop({ intervalMs: 60_000 })
    expect(timer).not.toBeNull()
    await stopBatchSchedulerLoop()
  })
})
