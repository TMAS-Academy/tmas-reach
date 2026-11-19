import crypto from 'node:crypto'
import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { getConfig } from '../lib/config.js'
import { requireAuth, requireMinimumRole } from '../middleware/rbac.js'
import { contactsDb } from './contacts.js'
import { appendActivityLog } from './logs.js'

export interface EmailTemplateRecord {
  id: string
  name: string
  subject_template: string
  body_html?: string
  body_text?: string
  created_by: string
  created_at: string
  updated_at: string
}

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'cancelled'

export interface CampaignRecord {
  id: string
  name: string
  template_id: string
  target_audience_tag: string
  status: CampaignStatus
  scheduled_at?: string
  batch_size: number
  created_by: string
  reviewed_by?: string
  review_notes?: string
  created_at: string
  updated_at: string
}

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'failed'
  | 'skipped_suppressed'

export interface CampaignRecipientRecord {
  id: string
  campaign_id: string
  contact_id: string
  email: string
  personalized_subject: string
  personalized_body: string
  delivery_status: DeliveryStatus
  provider_message_id?: string
  error_message?: string
  retry_count?: number
  next_retry_at?: string
  sent_at?: string
  delivered_at?: string
  bounced_at?: string
}

export const templatesDb: EmailTemplateRecord[] = [
  {
    id: 'tmpl_official_outreach',
    name: 'TMAS Academy Official Outreach',
    subject_template: 'Advancing Math Excellence at {{organization}}',
    body_text:
      'Dear {{first_name}},\n\nWe would love to share TMAS Academy resources with your students at {{organization}}.\n\nTo opt out: {{unsubscribe_url}}',
    created_by: 'usr_admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const campaignsDb: CampaignRecord[] = []
export const campaignRecipientsDb: CampaignRecipientRecord[] = []

function renderTemplateText(
  template: string,
  values: {
    first_name: string
    last_name: string
    organization: string
    job_role: string
    unsubscribe_url: string
  }
): string {
  return template
    .replace(/\{\{\s*first_name\s*\}\}/g, values.first_name)
    .replace(/\{\{\s*last_name\s*\}\}/g, values.last_name)
    .replace(/\{\{\s*organization\s*\}\}/g, values.organization)
    .replace(/\{\{\s*job_role\s*\}\}/g, values.job_role)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, values.unsubscribe_url)
}

export function registerCampaignRoutes(router: Router) {
  // GET /api/templates
  router.get('/api/templates', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return
    res.status(200).json(templatesDb)
  })

  // POST /api/templates
  router.post('/api/templates', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { name, subject_template, body_html, body_text } = req.body || {}
    if (!name || typeof name !== 'string' || !name.trim() || !subject_template || typeof subject_template !== 'string' || !subject_template.trim()) {
      res.status(400).json({ error: 'name and subject_template are required.' })
      return
    }

    const fullBody = `${body_html || ''} ${body_text || ''}`
    if (!fullBody.includes('{{unsubscribe_url}}')) {
      res.status(400).json({
        error: 'CAN-SPAM compliance error: Template body must contain {{unsubscribe_url}} tag.',
      })
      return
    }

    const now = new Date().toISOString()
    const newTemplate: EmailTemplateRecord = {
      id: `tmpl_${crypto.randomUUID()}`,
      name: name.trim(),
      subject_template: subject_template.trim(),
      body_html: typeof body_html === 'string' ? body_html : undefined,
      body_text: typeof body_text === 'string' ? body_text : undefined,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }

    templatesDb.unshift(newTemplate)
    appendActivityLog({
      actor_id: user.id,
      action: 'template.created',
      entity_type: 'email_template',
      entity_id: newTemplate.id,
      metadata: { name: newTemplate.name },
    })
    res.status(201).json(newTemplate)
  })

  // GET /api/campaigns
  router.get('/api/campaigns', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return
    res.status(200).json(campaignsDb)
  })

  // POST /api/campaigns — Create draft
  router.post('/api/campaigns', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { name, template_id, target_audience_tag, scheduled_at, batch_size = 50 } = req.body || {}
    if (
      !name ||
      typeof name !== 'string' ||
      !name.trim() ||
      !template_id ||
      typeof template_id !== 'string' ||
      !target_audience_tag ||
      typeof target_audience_tag !== 'string' ||
      !target_audience_tag.trim()
    ) {
      res.status(400).json({ error: 'name, template_id, and target_audience_tag are required.' })
      return
    }

    const parsedBatchSize = Number(batch_size)
    if (!Number.isInteger(parsedBatchSize) || parsedBatchSize < 1 || parsedBatchSize > 500) {
      res.status(400).json({ error: 'batch_size must be an integer between 1 and 500.' })
      return
    }

    if (scheduled_at !== undefined && scheduled_at !== null && scheduled_at !== '') {
      if (typeof scheduled_at !== 'string' || Number.isNaN(Date.parse(scheduled_at))) {
        res.status(400).json({ error: 'scheduled_at must be a valid ISO-8601 timestamp.' })
        return
      }
    }

    const template = templatesDb.find((t) => t.id === template_id)
    if (!template) {
      res.status(404).json({ error: 'Template not found.' })
      return
    }

    const now = new Date().toISOString()
    const newCampaign: CampaignRecord = {
      id: `cmp_${crypto.randomUUID()}`,
      name: name.trim(),
      template_id,
      target_audience_tag: target_audience_tag.trim(),
      status: 'draft',
      scheduled_at: scheduled_at || undefined,
      batch_size: parsedBatchSize,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }

    campaignsDb.unshift(newCampaign)
    appendActivityLog({
      actor_id: user.id,
      action: 'campaign.created',
      entity_type: 'campaign',
      entity_id: newCampaign.id,
      metadata: { name: newCampaign.name, batch_size: newCampaign.batch_size },
    })
    res.status(201).json(newCampaign)
  })

  // POST /api/campaigns/:id/submit — Move draft or rejected -> pending_approval
  router.post('/api/campaigns/:id/submit', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const campaign = campaignsDb.find((c) => c.id === req.params.id)
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    if (campaign.status !== 'draft' && campaign.status !== 'rejected') {
      res.status(400).json({ error: `Cannot submit campaign in status "${campaign.status}".` })
      return
    }

    const matchingActiveContacts = contactsDb.filter(
      (c) =>
        c.status === 'active' &&
        (campaign.target_audience_tag === 'all' || c.audience_tag === campaign.target_audience_tag)
    )

    if (matchingActiveContacts.length === 0) {
      res.status(400).json({
        error: 'Target audience resolves to 0 active contacts. At least 1 active contact is required to submit.',
      })
      return
    }

    campaign.status = 'pending_approval'
    campaign.updated_at = new Date().toISOString()

    appendActivityLog({
      actor_id: user.id,
      action: 'campaign.submitted',
      entity_type: 'campaign',
      entity_id: campaign.id,
      metadata: { activeContactsCount: matchingActiveContacts.length },
    })

    res.status(200).json(campaign)
  })

  // POST /api/campaigns/:id/review — Marketing Lead / Administrator approval gate
  router.post('/api/campaigns/:id/review', (req: ApiRequest, res: ApiResponse) => {
    const user = requireMinimumRole('marketing_lead')(req, res)
    if (!user) return

    const campaign = campaignsDb.find((c) => c.id === req.params.id)
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    if (campaign.status !== 'pending_approval') {
      res.status(400).json({
        error: `Campaign must be in "pending_approval" status to be reviewed (current status: "${campaign.status}").`,
      })
      return
    }

    const { action, review_notes } = req.body || {}
    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Action must be "approve" or "reject".' })
      return
    }

    if (action === 'approve') {
      const template = templatesDb.find((t) => t.id === campaign.template_id)
      const matchingActive = contactsDb.filter(
        (c) =>
          c.status === 'active' &&
          (campaign.target_audience_tag === 'all' || c.audience_tag === campaign.target_audience_tag)
      )

      if (matchingActive.length === 0) {
        res.status(400).json({
          error: 'Cannot approve campaign with 0 active matching contacts.',
        })
        return
      }

      campaign.status = 'approved'
      campaign.reviewed_by = user.id
      campaign.review_notes = typeof review_notes === 'string' && review_notes.trim() ? review_notes.trim() : 'Approved for dispatch'

      const publicUrl = getConfig().appPublicUrl
      const existingContactIds = new Set(
        campaignRecipientsDb
          .filter((r) => r.campaign_id === campaign.id)
          .map((r) => r.contact_id)
      )

      for (const c of matchingActive) {
        if (existingContactIds.has(c.id)) {
          continue
        }
        existingContactIds.add(c.id)

        const unsubsUrl = `${publicUrl}/unsubscribe/${c.unsubscribe_token}`
        const values = {
          first_name: c.first_name || 'Educator',
          last_name: c.last_name || '',
          organization: c.organization || 'your school',
          job_role: c.job_role || '',
          unsubscribe_url: unsubsUrl,
        }

        const personalizedSubject = renderTemplateText(template?.subject_template || '', values)
        const personalizedBody = renderTemplateText(
          template?.body_text || template?.body_html || '',
          values
        )

        campaignRecipientsDb.push({
          id: `rcp_${crypto.randomUUID()}`,
          campaign_id: campaign.id,
          contact_id: c.id,
          email: c.email,
          personalized_subject: personalizedSubject,
          personalized_body: personalizedBody,
          delivery_status: 'queued',
          retry_count: 0,
        })
      }

      appendActivityLog({
        actor_id: user.id,
        action: 'campaign.approved',
        entity_type: 'campaign',
        entity_id: campaign.id,
        metadata: { recipientsQueued: existingContactIds.size },
      })
    } else {
      campaign.status = 'rejected'
      campaign.reviewed_by = user.id
      campaign.review_notes =
        typeof review_notes === 'string' && review_notes.trim() ? review_notes.trim() : 'Requires revision'

      appendActivityLog({
        actor_id: user.id,
        action: 'campaign.rejected',
        entity_type: 'campaign',
        entity_id: campaign.id,
        metadata: { review_notes: campaign.review_notes },
      })
    }

    campaign.updated_at = new Date().toISOString()
    res.status(200).json(campaign)
  })

  // GET /api/campaigns/:id/report — Campaign delivery summary
  router.get('/api/campaigns/:id/report', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const campaign = campaignsDb.find((c) => c.id === req.params.id)
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const recipients = campaignRecipientsDb.filter((r) => r.campaign_id === campaign.id)
    const queued = recipients.filter((r) => r.delivery_status === 'queued').length
    const sent = recipients.filter((r) => r.delivery_status === 'sent').length
    const delivered = recipients.filter((r) => r.delivery_status === 'delivered').length
    const bounced = recipients.filter((r) => r.delivery_status === 'bounced').length
    const unsubscribed = recipients.filter((r) => r.delivery_status === 'unsubscribed').length
    const failed = recipients.filter((r) => r.delivery_status === 'failed').length
    const skippedSuppressed = recipients.filter((r) => r.delivery_status === 'skipped_suppressed').length

    res.status(200).json({
      campaign_id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      metrics: {
        total_recipients: recipients.length,
        queued,
        sent,
        delivered,
        bounced,
        unsubscribed,
        failed,
        skipped_suppressed: skippedSuppressed,
        delivery_rate: sent + delivered > 0 ? ((delivered / (sent + delivered)) * 100).toFixed(1) + '%' : '0%',
      },
    })
  })
}
