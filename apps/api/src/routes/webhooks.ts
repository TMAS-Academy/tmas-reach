import crypto from 'node:crypto'
import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { getConfig } from '../lib/config.js'
import { getActiveStore } from '../lib/sqliteStore.js'
import { campaignRecipientsDb } from './campaigns.js'
import { contactsDb } from './contacts.js'
import { appendActivityLog } from './logs.js'

export const WEBHOOK_SIGNING_SECRET = getConfig().webhookSigningSecret
export const WEBHOOK_REPLAY_WINDOW_SEC = 300
const MAX_PROCESSED_EVENTS = 10_000

const processedEventIds = new Map<string, number>()

export function clearProcessedWebhookEvents(): void {
  processedEventIds.clear()
}

function getHeaderString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value) && value.length > 0) return value[0]?.trim() || undefined
  return undefined
}

function timingSafeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function parseTimestampSeconds(raw: string): number | null {
  const trimmed = raw.trim()
  if (/^\d+$/.test(trimmed)) {
    const num = Number.parseInt(trimmed, 10)
    // Accept both unix seconds and milliseconds
    return num > 1_000_000_000_000 ? Math.floor(num / 1000) : num
  }
  const parsedMs = Date.parse(trimmed)
  if (Number.isNaN(parsedMs)) return null
  return Math.floor(parsedMs / 1000)
}

export function isTimestampWithinWindow(
  rawTimestamp: string,
  nowMs: number = Date.now(),
  windowSec: number = WEBHOOK_REPLAY_WINDOW_SEC
): boolean {
  const tsSec = parseTimestampSeconds(rawTimestamp)
  if (tsSec === null) return false
  const nowSec = Math.floor(nowMs / 1000)
  return Math.abs(nowSec - tsSec) <= windowSec
}

export function verifyWebhookSignature(
  payloadString: string,
  signatureHeader?: string | string[],
  secret: string = getConfig().webhookSigningSecret
): boolean {
  const rawSig = getHeaderString(signatureHeader)
  if (!rawSig) return false

  const normalizedSig = rawSig.toLowerCase().startsWith('sha256=')
    ? rawSig.slice('sha256='.length).trim().toLowerCase()
    : rawSig.toLowerCase()

  if (!/^[0-9a-f]{64}$/.test(normalizedSig)) {
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString, 'utf8')
    .digest('hex')

  return timingSafeCompareStrings(normalizedSig, expectedSignature)
}

export function verifySvixSignature(
  payloadString: string,
  headers: {
    svixId?: string
    svixTimestamp?: string
    svixSignature?: string
  },
  secret: string = getConfig().webhookSigningSecret,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string } {
  const { svixId, svixTimestamp, svixSignature } = headers
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: 'Missing required Svix webhook headers.' }
  }

  if (!isTimestampWithinWindow(svixTimestamp, nowMs)) {
    return { valid: false, reason: 'Webhook timestamp is outside the 5-minute replay window.' }
  }

  const signingKey = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8')

  const signedContent = `${svixId}.${svixTimestamp}.${payloadString}`
  const expectedBase64 = crypto
    .createHmac('sha256', signingKey)
    .update(signedContent, 'utf8')
    .digest('base64')

  const candidates = svixSignature.split(/\s+/).filter(Boolean)
  for (const candidate of candidates) {
    const [version, sig] = candidate.split(',', 2)
    if (version === 'v1' && sig && timingSafeCompareStrings(sig, expectedBase64)) {
      return { valid: true }
    }
  }

  return { valid: false, reason: 'Invalid Svix webhook signature.' }
}

function hasProcessedEvent(eventId: string): boolean {
  if (processedEventIds.has(eventId)) return true
  return getActiveStore()?.hasProcessedWebhook(eventId) ?? false
}

function markEventProcessed(eventId: string, eventType: string): void {
  if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
    const oldestKey = processedEventIds.keys().next().value
    if (oldestKey !== undefined) {
      processedEventIds.delete(oldestKey)
    }
  }
  processedEventIds.set(eventId, Date.now())
  getActiveStore()?.recordProcessedWebhook(eventId, eventType)
}

function normalizeWebhookEvent(payload: any): {
  type?: string
  recipientId?: string
  providerMessageId?: string
  email?: string
  timestamp?: string
  eventId?: string
} {
  if (!payload || typeof payload !== 'object') return {}

  const rawType = typeof payload.type === 'string' ? payload.type.toLowerCase() : undefined
  let normalizedType = rawType
  if (rawType === 'email.delivered') normalizedType = 'delivered'
  else if (rawType === 'email.bounced') normalizedType = 'bounced'
  else if (rawType === 'email.complained') normalizedType = 'complained'

  const data = payload.data && typeof payload.data === 'object' ? payload.data : null
  const dataEmail =
    typeof data?.to === 'string'
      ? data.to
      : Array.isArray(data?.to) && typeof data.to[0] === 'string'
        ? data.to[0]
        : typeof data?.email === 'string'
          ? data.email
          : undefined

  return {
    type: normalizedType,
    recipientId: typeof payload.recipient_id === 'string' ? payload.recipient_id : undefined,
    providerMessageId:
      typeof payload.provider_message_id === 'string'
        ? payload.provider_message_id
        : typeof data?.email_id === 'string'
          ? data.email_id
          : undefined,
    email: typeof payload.email === 'string' ? payload.email : dataEmail,
    timestamp:
      typeof payload.timestamp === 'string'
        ? payload.timestamp
        : typeof payload.created_at === 'string'
          ? payload.created_at
          : undefined,
    eventId:
      typeof payload.event_id === 'string'
        ? payload.event_id
        : typeof payload.id === 'string'
          ? payload.id
          : undefined,
  }
}

function cancelQueuedRecipientsForEmail(email: string, contactId?: string): number {
  const normEmail = email.toLowerCase()
  let cancelled = 0
  for (const r of campaignRecipientsDb) {
    if (
      r.delivery_status === 'queued' &&
      ((contactId && r.contact_id === contactId) || r.email.toLowerCase() === normEmail)
    ) {
      r.delivery_status = 'skipped_suppressed'
      cancelled++
    }
  }
  return cancelled
}

export function registerWebhookRoutes(router: Router) {
  // POST /api/webhooks/email — ESP Webhook endpoint (supports x-esp-signature and Svix/Resend headers)
  router.post('/api/webhooks/email', (req: ApiRequest, res: ApiResponse) => {
    const rawBody =
      req.rawBodyText !== undefined
        ? req.rawBodyText
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)

    const svixId = getHeaderString(req.headers['svix-id'])
    const svixTimestamp = getHeaderString(req.headers['svix-timestamp'])
    const svixSignature = getHeaderString(req.headers['svix-signature'])
    const espSignature = getHeaderString(req.headers['x-esp-signature'])
    const espTimestamp = getHeaderString(req.headers['x-esp-timestamp'])
    const espEventId = getHeaderString(req.headers['x-esp-event-id'])

    if (process.env.NODE_ENV !== 'test-skip-sig') {
      const secret = getConfig().webhookSigningSecret
      const hasSvixHeaders = Boolean(svixId || svixTimestamp || svixSignature)

      if (hasSvixHeaders) {
        const check = verifySvixSignature(
          rawBody,
          { svixId, svixTimestamp, svixSignature },
          secret
        )
        if (!check.valid) {
          res.status(401).json({ error: check.reason || 'Invalid webhook signature.' })
          return
        }
      } else {
        if (espTimestamp && !isTimestampWithinWindow(espTimestamp)) {
          res.status(401).json({ error: 'Webhook timestamp is outside the 5-minute replay window.' })
          return
        }
        if (!verifyWebhookSignature(rawBody, espSignature, secret)) {
          res.status(401).json({ error: 'Invalid webhook signature.' })
          return
        }
      }
    }

    let payload: any
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      res.status(400).json({ error: 'Invalid webhook JSON payload.' })
      return
    }

    const event = normalizeWebhookEvent(payload)
    if (!event.type || (!event.recipientId && !event.providerMessageId && !event.email)) {
      res.status(400).json({ error: 'type and recipient_id/email are required.' })
      return
    }

    const dedupeId = svixId || espEventId || event.eventId
    if (dedupeId && hasProcessedEvent(dedupeId)) {
      res.status(200).json({
        received: true,
        duplicate: true,
        event_id: dedupeId,
        event_type: event.type,
        processed_at: new Date().toISOString(),
      })
      return
    }

    const recipient =
      (event.recipientId && campaignRecipientsDb.find((r) => r.id === event.recipientId)) ||
      (event.providerMessageId &&
        campaignRecipientsDb.find((r) => r.provider_message_id === event.providerMessageId)) ||
      (event.email &&
        campaignRecipientsDb.find(
          (r) =>
            r.email.toLowerCase() === event.email!.toLowerCase() &&
            r.delivery_status !== 'queued' &&
            r.delivery_status !== 'skipped_suppressed'
        )) ||
      undefined

    const resolvedEmail = event.email || recipient?.email
    const eventTime = event.timestamp || new Date().toISOString()
    let cancelledQueuedCount = 0

    switch (event.type) {
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
        if (resolvedEmail) {
          const contact = contactsDb.find(
            (c) => c.email.toLowerCase() === resolvedEmail.toLowerCase()
          )
          if (contact) {
            contact.status = 'bounced'
            contact.updated_at = eventTime
          }
          cancelledQueuedCount = cancelQueuedRecipientsForEmail(resolvedEmail, contact?.id)
        }
        break

      case 'complained':
        if (recipient) {
          recipient.delivery_status = 'complained'
        }
        if (resolvedEmail) {
          const contact = contactsDb.find(
            (c) => c.email.toLowerCase() === resolvedEmail.toLowerCase()
          )
          if (contact) {
            contact.status = 'suppressed'
            contact.updated_at = eventTime
          }
          cancelledQueuedCount = cancelQueuedRecipientsForEmail(resolvedEmail, contact?.id)
        }
        break

      default:
        break
    }

    if (dedupeId) {
      markEventProcessed(dedupeId, event.type)
    }

    appendActivityLog({
      actor_id: null,
      action: `webhook.${event.type}`,
      entity_type: 'webhook',
      entity_id: dedupeId ?? recipient?.id ?? null,
      metadata: {
        email: resolvedEmail,
        cancelledQueuedCount,
      },
    })

    res.status(200).json({
      received: true,
      duplicate: false,
      event_type: event.type,
      cancelledQueuedCount,
      processed_at: new Date().toISOString(),
    })
  })
}
