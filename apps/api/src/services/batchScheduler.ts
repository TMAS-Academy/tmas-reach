import { getConfig } from '../lib/config.js'
import type { Logger } from '../lib/logger.js'
import { syncPersistence } from '../lib/sqliteStore.js'
import { campaignsDb, campaignRecipientsDb } from '../routes/campaigns.js'
import { contactsDb } from '../routes/contacts.js'
import {
  createEmailProvider,
  createMockEmailProvider,
  type EmailSenderClient,
} from './emailProvider.js'

export type { EmailSenderClient, EmailSendOptions, EmailSendResult } from './emailProvider.js'

export const defaultMockSenderClient: EmailSenderClient = createMockEmailProvider()

export interface BatchRunResult {
  campaignsProcessed: number
  emailsSent: number
  skippedSuppressed: number
  retriedCount: number
  failedCount: number
  errorsCount: number
  completedCampaigns: string[]
  skippedDueToLock?: boolean
}

export interface BatchSchedulerOptions {
  campaignId?: string
  maxRetries?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  rateLimitPerSec?: number
  now?: () => number
  random?: () => number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class TokenBucketRateLimiter {
  private readonly ratePerSec: number
  private readonly capacity: number
  private tokens: number
  private lastRefillMs: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(
    ratePerSec: number,
    options?: { now?: () => number; sleep?: (ms: number) => Promise<void> }
  ) {
    this.ratePerSec = ratePerSec
    this.capacity = Math.max(1, Math.floor(ratePerSec))
    this.tokens = this.capacity
    this.now = options?.now ?? Date.now
    this.sleep = options?.sleep ?? defaultSleep
    this.lastRefillMs = this.now()
  }

  private refill(): void {
    const current = this.now()
    const elapsedSec = Math.max(0, (current - this.lastRefillMs) / 1000)
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.ratePerSec)
      this.lastRefillMs = current
    }
  }

  public async acquire(): Promise<void> {
    if (!Number.isFinite(this.ratePerSec) || this.ratePerSec <= 0) return

    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    const deficit = 1 - this.tokens
    const waitMs = Math.ceil((deficit / this.ratePerSec) * 1000)
    await this.sleep(waitMs)
    this.tokens = Math.max(0, this.tokens + (waitMs / 1000) * this.ratePerSec - 1)
    this.lastRefillMs = this.now()
  }
}

let activeTickPromise: Promise<BatchRunResult> | null = null
let schedulerTimer: NodeJS.Timeout | null = null

function isContactSuppressed(contactId: string, email: string): boolean {
  const normEmail = email.toLowerCase()
  const contact = contactsDb.find(
    (c) => c.id === contactId || c.email.toLowerCase() === normEmail
  )
  if (!contact) return false
  return contact.status !== 'active'
}

function computeBackoffMs(
  retryCount: number,
  baseBackoffMs: number,
  maxBackoffMs: number,
  random: () => number,
  retryAfterMs?: number
): number {
  if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(maxBackoffMs, Math.ceil(retryAfterMs))
  }
  const exponential = Math.min(maxBackoffMs, baseBackoffMs * 2 ** Math.max(0, retryCount - 1))
  // Full-ish jitter in [0.75, 1.25] range to prevent thundering herd retries
  const jitterFactor = 0.75 + random() * 0.5
  return Math.min(maxBackoffMs, Math.max(1, Math.round(exponential * jitterFactor)))
}

async function executeBatchTick(
  senderClient: EmailSenderClient,
  options: BatchSchedulerOptions
): Promise<BatchRunResult> {
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const sleep = options.sleep ?? defaultSleep
  const maxRetries = options.maxRetries ?? 3
  const baseBackoffMs = options.baseBackoffMs ?? 1000
  const maxBackoffMs = options.maxBackoffMs ?? 60_000
  const rateLimitPerSec = options.rateLimitPerSec ?? getConfig().rateLimitPerSec
  const limiter = new TokenBucketRateLimiter(rateLimitPerSec, { now, sleep })

  const result: BatchRunResult = {
    campaignsProcessed: 0,
    emailsSent: 0,
    skippedSuppressed: 0,
    retriedCount: 0,
    failedCount: 0,
    errorsCount: 0,
    completedCampaigns: [],
  }

  const activeCampaigns = campaignsDb.filter((c) => {
    if (options.campaignId && c.id !== options.campaignId) return false
    return c.status === 'approved' || c.status === 'sending'
  })

  for (const campaign of activeCampaigns) {
    if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > now()) {
      continue
    }

    result.campaignsProcessed++
    if (campaign.status === 'approved') {
      campaign.status = 'sending'
      campaign.updated_at = new Date(now()).toISOString()
    }

    const alreadyDispatchedContacts = new Set(
      campaignRecipientsDb
        .filter(
          (r) =>
            r.campaign_id === campaign.id &&
            (r.delivery_status === 'sent' ||
              r.delivery_status === 'delivered' ||
              r.delivery_status === 'bounced' ||
              r.delivery_status === 'complained')
        )
        .map((r) => r.contact_id)
    )

    const readyQueued = campaignRecipientsDb.filter((r) => {
      if (r.campaign_id !== campaign.id || r.delivery_status !== 'queued') return false
      if (r.next_retry_at && Date.parse(r.next_retry_at) > now()) return false
      return true
    })

    const batch = readyQueued.slice(0, campaign.batch_size || 50)

    for (const recipient of batch) {
      // Pre-send duplicate guard
      if (recipient.sent_at || alreadyDispatchedContacts.has(recipient.contact_id)) {
        recipient.delivery_status = 'skipped_suppressed'
        recipient.error_message = 'Duplicate send prevented'
        result.skippedSuppressed++
        continue
      }

      // Runtime suppression re-check against contactsDb right before dispatch
      if (isContactSuppressed(recipient.contact_id, recipient.email)) {
        recipient.delivery_status = 'skipped_suppressed'
        recipient.error_message = 'Contact is no longer active'
        result.skippedSuppressed++
        continue
      }

      await limiter.acquire()

      const idempotencyKey = `${campaign.id}:${recipient.id}`
      try {
        const sendRes = await senderClient.sendEmail(
          recipient.email,
          recipient.personalized_subject,
          recipient.personalized_body,
          { idempotencyKey }
        )

        if (sendRes.success) {
          recipient.delivery_status = 'sent'
          recipient.sent_at = new Date(now()).toISOString()
          recipient.provider_message_id = sendRes.messageId
          recipient.error_message = undefined
          recipient.next_retry_at = undefined
          alreadyDispatchedContacts.add(recipient.contact_id)
          result.emailsSent++
        } else {
          result.errorsCount++
          const nextRetries = (recipient.retry_count ?? 0) + 1
          recipient.retry_count = nextRetries
          recipient.error_message = sendRes.error || 'Email dispatch failed'

          if (sendRes.retryable === false || nextRetries >= maxRetries) {
            recipient.delivery_status = 'failed'
            recipient.next_retry_at = undefined
            result.failedCount++
          } else {
            const delayMs = computeBackoffMs(
              nextRetries,
              baseBackoffMs,
              maxBackoffMs,
              random,
              sendRes.retryAfterMs
            )
            recipient.next_retry_at = new Date(now() + delayMs).toISOString()
            result.retriedCount++
          }
        }
      } catch (err) {
        result.errorsCount++
        const nextRetries = (recipient.retry_count ?? 0) + 1
        recipient.retry_count = nextRetries
        recipient.error_message = err instanceof Error ? err.message : String(err)

        if (nextRetries >= maxRetries) {
          recipient.delivery_status = 'failed'
          recipient.next_retry_at = undefined
          result.failedCount++
        } else {
          const delayMs = computeBackoffMs(nextRetries, baseBackoffMs, maxBackoffMs, random)
          recipient.next_retry_at = new Date(now() + delayMs).toISOString()
          result.retriedCount++
        }
      }
    }

    const remainingQueued = campaignRecipientsDb.some(
      (r) => r.campaign_id === campaign.id && r.delivery_status === 'queued'
    )

    if (!remainingQueued) {
      campaign.status = 'completed'
      campaign.updated_at = new Date(now()).toISOString()
      result.completedCampaigns.push(campaign.id)
    }
  }

  return result
}

export async function runBatchSchedulerTick(
  senderClient: EmailSenderClient = defaultMockSenderClient,
  options: BatchSchedulerOptions = {}
): Promise<BatchRunResult> {
  if (activeTickPromise) {
    return {
      campaignsProcessed: 0,
      emailsSent: 0,
      skippedSuppressed: 0,
      retriedCount: 0,
      failedCount: 0,
      errorsCount: 0,
      completedCampaigns: [],
      skippedDueToLock: true,
    }
  }

  const runPromise = executeBatchTick(senderClient, options)
  activeTickPromise = runPromise
  try {
    return await runPromise
  } finally {
    if (activeTickPromise === runPromise) {
      activeTickPromise = null
    }
  }
}

export interface BatchSchedulerLoopOptions {
  intervalMs?: number
  senderClient?: EmailSenderClient
  logger?: Logger
}

export function startBatchSchedulerLoop(options: BatchSchedulerLoopOptions = {}): NodeJS.Timeout | null {
  if (schedulerTimer) return schedulerTimer

  const intervalMs = options.intervalMs ?? getConfig().schedulerIntervalMs
  if (intervalMs <= 0) return null

  const sender = options.senderClient ?? createEmailProvider()

  schedulerTimer = setInterval(() => {
    void runBatchSchedulerTick(sender)
      .then((res) => {
        if (res.campaignsProcessed > 0) {
          syncPersistence()
          options.logger?.info('batch_scheduler_tick', {
            campaignsProcessed: res.campaignsProcessed,
            emailsSent: res.emailsSent,
            skippedSuppressed: res.skippedSuppressed,
            retriedCount: res.retriedCount,
            failedCount: res.failedCount,
            completedCampaigns: res.completedCampaigns,
          })
        }
      })
      .catch((err) => {
        options.logger?.error('batch_scheduler_tick_error', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
  }, intervalMs)

  schedulerTimer.unref()
  return schedulerTimer
}

export async function stopBatchSchedulerLoop(): Promise<void> {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
  if (activeTickPromise) {
    await activeTickPromise.catch(() => undefined)
  }
}
