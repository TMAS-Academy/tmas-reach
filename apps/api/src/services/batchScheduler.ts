import { campaignsDb, campaignRecipientsDb, type CampaignRecord, type CampaignRecipientRecord } from '../routes/campaigns.js'

export interface EmailSenderClient {
  sendEmail: (to: string, subject: string, body: string) => Promise<{ success: boolean; messageId?: string; error?: string }>
}

export const defaultMockSenderClient: EmailSenderClient = {
  async sendEmail(to: string, subject: string) {
    // Simulated Resend / SES dispatch
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    }
  },
}

export interface BatchRunResult {
  campaignsProcessed: number
  emailsSent: number
  errorsCount: number
  completedCampaigns: string[]
}

export async function runBatchSchedulerTick(
  senderClient: EmailSenderClient = defaultMockSenderClient
): Promise<BatchRunResult> {
  const result: BatchRunResult = {
    campaignsProcessed: 0,
    emailsSent: 0,
    errorsCount: 0,
    completedCampaigns: [],
  }

  // Find campaigns ready to send: either 'approved' or already 'sending'
  const activeCampaigns = campaignsDb.filter(
    (c) => c.status === 'approved' || c.status === 'sending'
  )

  for (const campaign of activeCampaigns) {
    // If scheduled for the future, skip
    if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) {
      continue
    }

    result.campaignsProcessed++
    if (campaign.status === 'approved') {
      campaign.status = 'sending'
      campaign.updated_at = new Date().toISOString()
    }

    // Get next queued batch up to campaign.batch_size
    const queuedRecipients = campaignRecipientsDb.filter(
      (r) => r.campaign_id === campaign.id && r.delivery_status === 'queued'
    )

    const batch = queuedRecipients.slice(0, campaign.batch_size || 50)

    for (const recipient of batch) {
      try {
        const sendRes = await senderClient.sendEmail(
          recipient.email,
          recipient.personalized_subject,
          recipient.personalized_body
        )

        if (sendRes.success) {
          recipient.delivery_status = 'sent'
          recipient.sent_at = new Date().toISOString()
          result.emailsSent++
        } else {
          result.errorsCount++
        }
      } catch {
        result.errorsCount++
      }
    }

    // Check if any recipients remain queued
    const remainingQueued = campaignRecipientsDb.some(
      (r) => r.campaign_id === campaign.id && r.delivery_status === 'queued'
    )

    if (!remainingQueued) {
      campaign.status = 'completed'
      campaign.updated_at = new Date().toISOString()
      result.completedCampaigns.push(campaign.id)
    }
  }

  return result
}
