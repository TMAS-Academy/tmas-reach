import crypto from 'node:crypto'
import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { requireAuth } from '../middleware/rbac.js'
import {
  contactsDb,
  generateContactId,
  generateUnsubscribeToken,
  type ContactRecord,
} from './contacts.js'
import { appendActivityLog } from './logs.js'

export interface SurveyRecord {
  id: string
  email: string
  first_name: string
  last_name: string
  organization: string
  job_role: string
  audience_tag: string
  grade_levels?: string[]
  estimated_students?: number
  notes?: string
  consent_outreach: boolean
  status: 'pending_review' | 'imported_to_contacts' | 'archived'
  submitted_at: string
}

export const surveysDb: SurveyRecord[] = []

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function registerSurveyRoutes(router: Router) {
  // POST /api/surveys — Public intake form submission
  router.post('/api/surveys', (req: ApiRequest, res: ApiResponse) => {
    const {
      email,
      first_name,
      last_name,
      organization,
      job_role,
      audience_tag,
      grade_levels,
      estimated_students,
      notes,
      consent_outreach,
    } = req.body || {}

    const errors: string[] = []

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      errors.push('Valid school/work email is required.')
    }
    if (!first_name || typeof first_name !== 'string' || !first_name.trim()) errors.push('First name is required.')
    if (!last_name || typeof last_name !== 'string' || !last_name.trim()) errors.push('Last name is required.')
    if (!organization || typeof organization !== 'string' || !organization.trim()) {
      errors.push('School or district organization is required.')
    }
    if (!job_role || typeof job_role !== 'string' || !job_role.trim()) errors.push('Job role/title is required.')
    if (!audience_tag || typeof audience_tag !== 'string' || !audience_tag.trim()) {
      errors.push('Audience tag is required.')
    }
    if (!consent_outreach) errors.push('Consent to receive TMAS Academy outreach is required.')

    let parsedStudents: number | undefined
    if (estimated_students !== undefined && estimated_students !== null && estimated_students !== '') {
      const n = Number(estimated_students)
      if (!Number.isFinite(n) || n < 0) {
        errors.push('Estimated students must be a non-negative number.')
      } else {
        parsedStudents = Math.floor(n)
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors })
      return
    }

    const newSurvey: SurveyRecord = {
      id: `srv_${crypto.randomUUID()}`,
      email: email.trim().toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      organization: organization.trim(),
      job_role: job_role.trim(),
      audience_tag: audience_tag.trim(),
      grade_levels: Array.isArray(grade_levels) ? grade_levels.map(String) : [],
      estimated_students: parsedStudents,
      notes: typeof notes === 'string' ? notes.trim() : '',
      consent_outreach: Boolean(consent_outreach),
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
    }

    surveysDb.unshift(newSurvey)
    appendActivityLog({
      actor_id: null,
      action: 'survey.submitted',
      entity_type: 'survey',
      entity_id: newSurvey.id,
      metadata: { organization: newSurvey.organization, audience_tag: newSurvey.audience_tag },
    })

    res.status(201).json({
      success: true,
      message: 'Thank you! Your submission has been received by TMAS Academy.',
      submission_id: newSurvey.id,
    })
  })

  // GET /api/surveys — Authenticated staff review
  router.get('/api/surveys', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { status } = req.query
    let result = [...surveysDb]
    if (status && status !== 'all') {
      result = result.filter((s) => s.status === status)
    }

    res.status(200).json(result)
  })

  // POST /api/surveys/:id/promote — Move verified submission into contacts
  router.post('/api/surveys/:id/promote', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const survey = surveysDb.find((s) => s.id === req.params.id)
    if (!survey) {
      res.status(404).json({ error: 'Survey submission not found.' })
      return
    }

    if (survey.status !== 'pending_review') {
      res.status(400).json({ error: `Survey submission is already in status "${survey.status}".` })
      return
    }

    const existingContact = contactsDb.find((c) => c.email.toLowerCase() === survey.email.toLowerCase())
    if (existingContact) {
      res.status(409).json({ error: `A contact with email "${survey.email}" already exists in the system.` })
      return
    }

    const now = new Date().toISOString()
    const newContact: ContactRecord = {
      id: generateContactId(),
      email: survey.email,
      first_name: survey.first_name,
      last_name: survey.last_name,
      organization: survey.organization,
      job_role: survey.job_role,
      audience_tag: survey.audience_tag,
      status: 'active',
      unsubscribe_token: generateUnsubscribeToken(),
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }

    contactsDb.unshift(newContact)
    survey.status = 'imported_to_contacts'

    appendActivityLog({
      actor_id: user.id,
      action: 'survey.promoted',
      entity_type: 'survey',
      entity_id: survey.id,
      metadata: { contact_id: newContact.id, email: newContact.email },
    })

    res.status(200).json({
      success: true,
      contact: newContact,
      survey,
    })
  })
}
