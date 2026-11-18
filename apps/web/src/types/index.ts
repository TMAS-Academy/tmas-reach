export type UserRole = 'marketing_intern' | 'marketing_lead' | 'administrator'

export type ContactStatus = 'active' | 'unsubscribed' | 'bounced' | 'suppressed'

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'cancelled'

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'skipped_suppressed'

export interface User {
  id: string
  email: string
  full_name: string
  role: user_role_alias
  is_active: boolean
  created_at: string
  updated_at: string
}

type user_role_alias = UserRole

export interface Contact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  organization?: string
  district?: string
  job_role?: string
  audience_tag?: string
  status: ContactStatus
  unsubscribe_token: string
  notes?: string
  last_contacted_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject_template: string
  body_html: string
  body_text: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  template_id: string
  target_audience_tag?: string
  status: CampaignStatus
  scheduled_for?: string
  batch_size: number
  created_by: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  delivery_status: DeliveryStatus
  provider_message_id?: string
  error_message?: string
  sent_at?: string
  delivered_at?: string
  bounced_at?: string
  created_at: string
}

export interface ActivityLog {
  id: string
  actor_id?: string
  actor_name: string
  action: string
  entity_type: string
  entity_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}
