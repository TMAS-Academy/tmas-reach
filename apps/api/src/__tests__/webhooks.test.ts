import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'crypto'
import { verifyWebhookSignature, WEBHOOK_SIGNING_SECRET, registerWebhookRoutes } from '../routes/webhooks.js'
import { Router, createServerApp, type ApiRequest, type ApiResponse } from '../server.js'
import { contactsDb, type ContactRecord } from '../routes/contacts.js'
import { campaignRecipientsDb, type CampaignRecipientRecord } from '../routes/campaigns.js'

describe('Webhooks & Bounce Suppression', () => {
  beforeEach(() => {
    contactsDb.length = 0
    campaignRecipientsDb.length = 0
  })

  it('validates authentic HMAC-SHA256 signature and rejects forged signatures', () => {
    const payload = JSON.stringify({ type: 'delivered', email: 'educator@school.edu' })
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(payload)
      .digest('hex')

    expect(verifyWebhookSignature(payload, validSignature)).toBe(true)
    expect(verifyWebhookSignature(payload, 'forged_fake_signature')).toBe(false)
    expect(verifyWebhookSignature(payload, undefined)).toBe(false)
  })

  it('marks contact as bounced when receiving a bounce webhook event', async () => {
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

    const recipient: CampaignRecipientRecord = {
      id: 'rcp_123',
      campaign_id: 'cmp_1',
      contact_id: contact.id,
      email: contact.email,
      personalized_subject: 'Test',
      personalized_body: 'Test',
      delivery_status: 'sent',
    }
    campaignRecipientsDb.push(recipient)

    const router = new Router()
    registerWebhookRoutes(router)

    const payload = {
      type: 'bounced',
      recipient_id: recipient.id,
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
    expect(recipient.delivery_status).toBe('bounced')
    expect(contact.status).toBe('bounced')
  })

  it('marks contact as suppressed upon spam complaint', async () => {
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
    }

    const mockRes: ApiResponse = {
      status() { return mockRes },
      json() {},
      text() {},
      send() {},
    }

    const match = router.match('POST', '/api/webhooks/email')
    if (match) {
      await match.route.handler(mockReq, mockRes)
    }

    expect(contact.status).toBe('suppressed')
  })
})
