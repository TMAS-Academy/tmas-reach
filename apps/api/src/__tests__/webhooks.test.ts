import http from 'node:http'
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  WEBHOOK_SIGNING_SECRET,
  clearProcessedWebhookEvents,
  registerWebhookRoutes,
  verifySvixSignature,
  verifyWebhookSignature,
} from '../routes/webhooks.js'
import { Router, createServerApp, type ApiRequest, type ApiResponse } from '../server.js'
import { contactsDb, type ContactRecord } from '../routes/contacts.js'
import { campaignRecipientsDb, type CampaignRecipientRecord } from '../routes/campaigns.js'

const activeServers: http.Server[] = []
const originalWebhookSecret = process.env.WEBHOOK_SIGNING_SECRET

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
  contactsDb.length = 0
  campaignRecipientsDb.length = 0
  clearProcessedWebhookEvents()
  delete process.env.WEBHOOK_SIGNING_SECRET
})

afterEach(async () => {
  if (originalWebhookSecret === undefined) {
    delete process.env.WEBHOOK_SIGNING_SECRET
  } else {
    process.env.WEBHOOK_SIGNING_SECRET = originalWebhookSecret
  }
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
})

describe('Webhooks, Raw-Body Verification, Replay Protection & Bounce Suppression', () => {
  it('validates authentic HMAC-SHA256 signatures (hex and sha256= prefix) and rejects forged or short signatures', () => {
    const payload = JSON.stringify({ type: 'delivered', email: 'educator@school.edu' })
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(payload)
      .digest('hex')

    expect(verifyWebhookSignature(payload, validSignature)).toBe(true)
    expect(verifyWebhookSignature(payload, `sha256=${validSignature}`)).toBe(true)
    expect(verifyWebhookSignature(payload, 'forged_fake_signature')).toBe(false)
    expect(verifyWebhookSignature(payload, 'a'.repeat(64))).toBe(false)
    expect(verifyWebhookSignature(payload, undefined)).toBe(false)
  })

  it('verifies signature against raw HTTP body bytes even with non-canonical JSON whitespace', async () => {
    const router = new Router()
    registerWebhookRoutes(router)
    const server = http.createServer(createServerApp(router))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const rawBody = '{   "type": "delivered",   "email": "raw@school.edu"   }'
    const sig = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex')

    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-esp-signature': `sha256=${sig}`,
      },
      body: rawBody,
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { received: boolean; event_type: string }
    expect(body.received).toBe(true)
    expect(body.event_type).toBe('delivered')
  })

  it('verifies Svix/Resend signatures, enforces 5-minute replay window, and deduplicates event IDs', async () => {
    const rawSecret = Buffer.from('super-secret-svix-key-1234567890').toString('base64')
    const whsec = `whsec_${rawSecret}`
    process.env.WEBHOOK_SIGNING_SECRET = whsec

    const router = new Router()
    registerWebhookRoutes(router)
    const server = http.createServer(createServerApp(router))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const contact: ContactRecord = {
      id: 'cnt_svix_1',
      email: 'svix.teacher@school.edu',
      status: 'active',
      unsubscribe_token: 'tok_svix_1',
      created_by: 'usr_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    contactsDb.push(contact)

    const payloadText = JSON.stringify({
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: { email_id: 're_msg_1', to: ['svix.teacher@school.edu'] },
    })

    const signSvix = (id: string, tsSec: number) => {
      const sig = crypto
        .createHmac('sha256', Buffer.from(rawSecret, 'base64'))
        .update(`${id}.${tsSec}.${payloadText}`, 'utf8')
        .digest('base64')
      return `v1,${sig}`
    }

    // Stale timestamp (>5 minutes old) must be rejected
    const staleTs = Math.floor(Date.now() / 1000) - 600
    expect(
      verifySvixSignature(
        payloadText,
        { svixId: 'msg_stale', svixTimestamp: String(staleTs), svixSignature: signSvix('msg_stale', staleTs) },
        whsec
      ).valid
    ).toBe(false)

    const staleRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_stale',
        'svix-timestamp': String(staleTs),
        'svix-signature': signSvix('msg_stale', staleTs),
      },
      body: payloadText,
    })
    expect(staleRes.status).toBe(401)

    // Fresh Svix webhook succeeds
    const freshTs = Math.floor(Date.now() / 1000)
    const freshHeaders = {
      'Content-Type': 'application/json',
      'svix-id': 'msg_fresh_1',
      'svix-timestamp': String(freshTs),
      'svix-signature': signSvix('msg_fresh_1', freshTs),
    }

    const okRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/email`, {
      method: 'POST',
      headers: freshHeaders,
      body: payloadText,
    })
    expect(okRes.status).toBe(200)
    const firstJson = (await okRes.json()) as { duplicate: boolean }
    expect(firstJson.duplicate).toBe(false)
    expect(contact.status).toBe('bounced')

    // Replaying exact same svix-id returns idempotent 200 duplicate
    const dupRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/email`, {
      method: 'POST',
      headers: freshHeaders,
      body: payloadText,
    })
    expect(dupRes.status).toBe(200)
    const dupJson = (await dupRes.json()) as { duplicate: boolean; event_id: string }
    expect(dupJson.duplicate).toBe(true)
    expect(dupJson.event_id).toBe('msg_fresh_1')
  })

  it('marks contact as bounced and cancels remaining queued recipients across campaigns', async () => {
    const contact: ContactRecord = {
      id: 'cnt_123',
      email: 'bounced.teacher@school.edu',
      status: 'active',
      unsubscribe_token: 'tok_123',
      created_by: 'usr_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    contactsDb.push(contact)

    const sentRecipient: CampaignRecipientRecord = {
      id: 'rcp_123',
      campaign_id: 'cmp_1',
      contact_id: contact.id,
      email: contact.email,
      personalized_subject: 'Test 1',
      personalized_body: 'Test 1',
      delivery_status: 'sent',
    }
    const queuedRecipient: CampaignRecipientRecord = {
      id: 'rcp_124',
      campaign_id: 'cmp_2',
      contact_id: contact.id,
      email: contact.email,
      personalized_subject: 'Test 2',
      personalized_body: 'Test 2',
      delivery_status: 'queued',
    }
    campaignRecipientsDb.push(sentRecipient, queuedRecipient)

    const router = new Router()
    registerWebhookRoutes(router)

    const payload = {
      type: 'bounced',
      recipient_id: sentRecipient.id,
      email: contact.email,
      timestamp: new Date().toISOString(),
    }

    const payloadStr = JSON.stringify(payload)
    const validSig = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(payloadStr)
      .digest('hex')

    let statusCode = 0
    let resJson: any = null

    const mockReq: ApiRequest = {
      req: {} as any,
      method: 'POST',
      path: '/api/webhooks/email',
      query: {},
      params: {},
      headers: { 'x-esp-signature': validSig, 'content-type': 'application/json' },
      body: payload,
      rawBodyText: payloadStr,
    }

    const mockRes: ApiResponse = {
      status(code) {
        statusCode = code
        return mockRes
      },
      json(data) {
        resJson = data
      },
      text() {},
      send() {},
    }

    const match = router.match('POST', '/api/webhooks/email')
    expect(match).not.toBeNull()
    if (match) {
      await match.route.handler(mockReq, mockRes)
    }

    expect(statusCode).toBe(200)
    expect(resJson.received).toBe(true)
    expect(resJson.cancelledQueuedCount).toBe(1)
    expect(sentRecipient.delivery_status).toBe('bounced')
    expect(queuedRecipient.delivery_status).toBe('skipped_suppressed')
    expect(contact.status).toBe('bounced')
  })

  it('marks contact as suppressed upon spam complaint and cancels remaining queued recipients', async () => {
    const contact: ContactRecord = {
      id: 'cnt_456',
      email: 'complaint.user@district.edu',
      status: 'active',
      unsubscribe_token: 'tok_456',
      created_by: 'usr_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    contactsDb.push(contact)

    const queuedRecipient: CampaignRecipientRecord = {
      id: 'rcp_456_q',
      campaign_id: 'cmp_9',
      contact_id: contact.id,
      email: contact.email,
      personalized_subject: 'Follow-up',
      personalized_body: 'Follow-up',
      delivery_status: 'queued',
    }
    campaignRecipientsDb.push(queuedRecipient)

    const router = new Router()
    registerWebhookRoutes(router)

    const payload = {
      type: 'complained',
      email: contact.email,
    }

    const payloadStr = JSON.stringify(payload)
    const validSig = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(payloadStr)
      .digest('hex')

    const mockReq: ApiRequest = {
      req: {} as any,
      method: 'POST',
      path: '/api/webhooks/email',
      query: {},
      params: {},
      headers: { 'x-esp-signature': validSig, 'content-type': 'application/json' },
      body: payload,
      rawBodyText: payloadStr,
    }

    const mockRes: ApiResponse = {
      status() {
        return mockRes
      },
      json() {},
      text() {},
      send() {},
    }

    const match = router.match('POST', '/api/webhooks/email')
    if (match) {
      await match.route.handler(mockReq, mockRes)
    }

    expect(contact.status).toBe('suppressed')
    expect(queuedRecipient.delivery_status).toBe('skipped_suppressed')
  })
})
