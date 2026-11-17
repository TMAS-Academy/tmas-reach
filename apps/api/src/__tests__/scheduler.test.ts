import { describe, it, expect, beforeEach } from 'vitest'
import { runBatchSchedulerTick, type EmailSenderClient } from '../services/batchScheduler.js'
import { campaignsDb, campaignRecipientsDb, type CampaignRecord, type CampaignRecipientRecord } from '../routes/campaigns.js'

describe('Batch Scheduler Worker', () => {
  beforeEach(() => {
    campaignsDb.length = 0
    campaignRecipientsDb.length = 0
  })

  it('respects batch size and dispatches queued recipients incrementally', async () => {
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
    const mockSender: EmailSenderClient = {
      async sendEmail(to) {
        sentEmails.push(to)
        return { success: true, messageId: `msg_${to}` }
      },
    }

    // Tick 1: should send exactly batch_size (2) recipients
    const res1 = await runBatchSchedulerTick(mockSender)
    expect(res1.campaignsProcessed).toBe(1)
    expect(res1.emailsSent).toBe(2)
    expect(campaign.status).toBe('sending')
    expect(sentEmails).toHaveLength(2)

    // Tick 2: should send next 2 recipients
    const res2 = await runBatchSchedulerTick(mockSender)
    expect(res2.emailsSent).toBe(2)
    expect(campaign.status).toBe('sending')
    expect(sentEmails).toHaveLength(4)

    // Tick 3: should send final 1 recipient and complete campaign
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
})
