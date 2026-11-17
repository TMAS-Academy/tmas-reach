import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { requireAuth, requireMinimumRole } from '../middleware/rbac.js'
import { contactsDb } from './contacts.js'

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

export interface CampaignRecipientRecord {
  id: string
  campaign_id: string
  contact_id: string
  email: string
  personalized_subject: string
  personalized_body: string
  delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'unsubscribed'
  sent_at?: string
  delivered_at?: string
  bounced_at?: string
}

export const templatesDb: EmailTemplateRecord[] = [
  {
    id: 'tmpl_official_outreach',
    name: 'TMAS Academy Official Outreach',
    subject_template: 'Advancing Math Excellence at {{organization}}',
    body_text: 'Dear {{first_name}},\n\nWe would love to share TMAS Academy resources with your students at {{organization}}.\n\nTo opt out: {{unsubscribe_url}}',
    created_by: 'usr_admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const campaignsDb: CampaignRecord[] = []
export const campaignRecipientsDb: CampaignRecipientRecord[] = []

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
    if (!name || !subject_template) {
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

    const newTemplate: EmailTemplateRecord = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      subject_template: subject_template.trim(),
      body_html,
      body_text,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    templatesDb.unshift(newTemplate)
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
    if (!name || !template_id || !target_audience_tag) {
      res.status(400).json({ error: 'name, template_id, and target_audience_tag are required.' })
      return
    }

    const template = templatesDb.find((t) => t.id === template_id)
    if (!template) {
      res.status(404).json({ error: 'Template not found.' })
      return
    }

    const newCampaign: CampaignRecord = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      template_id,
      target_audience_tag,
      status: 'draft',
      scheduled_at,
      batch_size: Number(batch_size) || 50,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    campaignsDb.unshift(newCampaign)
    res.status(201).json(newCampaign)
  })

  // POST /api/campaigns/:id/submit — Move draft -> pending_approval
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

    // Check if target contacts exist
    const matchingActiveContacts = contactsDb.filter(
      (c) => c.status === 'active' && (campaign.target_audience_tag === 'all' || c.audience_tag === campaign.target_audience_tag)
    )

    if (matchingActiveContacts.length === 0) {
      res.status(400).json({
        error: 'Target audience resolves to 0 active contacts. At least 1 active contact is required to submit.',
      })
      return
    }

    campaign.status = 'pending_approval'
    campaign.updated_at = new Date().toISOString()
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

    const { action, review_notes } = req.body || {}
    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Action must be "approve" or "reject".' })
      return
    }

    if (action === 'approve') {
      campaign.status = 'approved'
      campaign.reviewed_by = user.id
      campaign.review_notes = review_notes || 'Approved for dispatch'

      // Snapshot eligible recipients
      const template = templatesDb.find((t) => t.id === campaign.template_id)
      const matchingActive = contactsDb.filter(
        (c) => c.status === 'active' && (campaign.target_audience_tag === 'all' || c.audience_tag === campaign.target_audience_tag)
      )

      matchingActive.forEach((c) => {
        const unsubsUrl = `https://reach.tmasacademy.org/unsubscribe/${c.unsubscribe_token}`
        const personalizedSubject = (template?.subject_template || '')
          .replace(/\{\{\s*organization\s*\}\}/g, c.organization || 'your school')
          .replace(/\{\{\s*first_name\s*\}\}/g, c.first_name || 'Educator')

        const personalizedBody = (template?.body_text || template?.body_html || '')
          .replace(/\{\{\s*first_name\s*\}\}/g, c.first_name || 'Educator')
          .replace(/\{\{\s*organization\s*\}\}/g, c.organization || 'your school')
          .replace(/\{\{\s*unsubscribe_url\s*\}\}/g, unsubsUrl)

        campaignRecipientsDb.push({
          id: `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          campaign_id: campaign.id,
          contact_id: c.id,
          email: c.email,
          personalized_subject: personalizedSubject,
          personalized_body: personalizedBody,
          delivery_status: 'queued',
        })
      })
    } else {
      campaign.status = 'rejected'
      campaign.reviewed_by = user.id
      campaign.review_notes = review_notes || 'Requires revision'
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
        delivery_rate: sent + delivered > 0 ? ((delivered / (sent + delivered)) * 100).toFixed(1) + '%' : '0%',
      },
    })
  })
}
