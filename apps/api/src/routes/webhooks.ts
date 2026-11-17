import crypto from 'crypto'
import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { campaignRecipientsDb } from './campaigns.js'
import { contactsDb } from './contacts.js'

export const WEBHOOK_SIGNING_SECRET = process.env.ESP_WEBHOOK_SECRET || 'test_webhook_secret_tmas'

export function verifyWebhookSignature(payloadString: string, signatureHeader?: string | string[]): boolean {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return false
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SIGNING_SECRET)
      .update(payloadString)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))
  } catch {
    return false
  }
}

export function registerWebhookRoutes(router: Router) {
  // POST /api/webhooks/email — ESP Webhook endpoint
  router.post('/api/webhooks/email', (req: ApiRequest, res: ApiResponse) => {
    const signature = req.headers['x-esp-signature']
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

    if (process.env.NODE_ENV !== 'test-skip-sig' && !verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature.' })
      return
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { type, recipient_id, email, timestamp } = payload || {}

    if (!type || (!recipient_id && !email)) {
      res.status(400).json({ error: 'type and recipient_id/email are required.' })
      return
    }

    const recipient = campaignRecipientsDb.find(
      (r) => r.id === recipient_id || (email && r.email.toLowerCase() === email.toLowerCase())
    )

    const eventTime = timestamp || new Date().toISOString()

    switch (type) {
      case 'delivered':
        if (recipient) {
          recipient.delivery_status = 'delivered'
          recipient.delivered_at = eventTime
        }
        break

      case 'bounced':
        if (recipient) {
          recipient.delivery_status = 'bounced'
          recipient.bounced_at = eventTime
        }
        // Auto-suppress contact to protect domain reputation
        if (email) {
          const contact = contactsDb.find((c) => c.email.toLowerCase() === email.toLowerCase())
          if (contact) {
            contact.status = 'bounced'
            contact.updated_at = eventTime
          }
        }
        break

      case 'complained':
        if (recipient) {
          recipient.delivery_status = 'complained'
        }
        // Strict suppression upon complaint
        if (email) {
          const contact = contactsDb.find((c) => c.email.toLowerCase() === email.toLowerCase())
          if (contact) {
            contact.status = 'suppressed'
            contact.updated_at = eventTime
          }
        }
        break

      default:
        // Ignore unhandled event types gracefully
        break
    }

    res.status(200).json({
      received: true,
      event_type: type,
      processed_at: new Date().toISOString(),
    })
  })
}
