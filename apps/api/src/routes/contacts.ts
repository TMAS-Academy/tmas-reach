import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { requireAuth, requireMinimumRole } from '../middleware/rbac.js'

export type ContactStatus = 'active' | 'unsubscribed' | 'bounced' | 'suppressed'

export interface ContactRecord {
  id: string
  email: string
  first_name?: string
  last_name?: string
  organization?: string
  job_role?: string
  audience_tag?: string
  status: ContactStatus
  unsubscribe_token: string
  created_by: string
  created_at: string
  updated_at: string
}

// Clean in-memory contacts store (no fake data)
export const contactsDb: ContactRecord[] = []

export function registerContactRoutes(router: Router) {
  // GET /api/contacts — list with filters and pagination
  router.get('/api/contacts', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const {
      search,
      organization,
      audience_tag,
      status,
      page = '1',
      limit = '25',
    } = req.query

    let result = [...contactsDb]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.organization?.toLowerCase().includes(q)
      )
    }

    if (organization) {
      result = result.filter((c) => c.organization === organization)
    }

    if (audience_tag) {
      result = result.filter((c) => c.audience_tag === audience_tag)
    }

    if (status) {
      result = result.filter((c) => c.status === status)
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.max(1, parseInt(limit, 10) || 25)
    const total = result.length
    const totalPages = Math.ceil(total / limitNum) || 1
    const offset = (pageNum - 1) * limitNum
    const items = result.slice(offset, offset + limitNum)

    res.status(200).json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    })
  })

  // POST /api/contacts — create single contact
  router.post('/api/contacts', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { email, first_name, last_name, organization, job_role, audience_tag } = req.body || {}

    if (!email || !email.trim()) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    const normEmail = email.trim().toLowerCase()
    const existing = contactsDb.find((c) => c.email.toLowerCase() === normEmail)
    if (existing) {
      res.status(409).json({ error: `Contact with email "${normEmail}" already exists.` })
      return
    }

    const newContact: ContactRecord = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: normEmail,
      first_name: first_name?.trim() || '',
      last_name: last_name?.trim() || '',
      organization: organization?.trim() || '',
      job_role: job_role?.trim() || '',
      audience_tag: audience_tag || 'educators',
      status: 'active',
      unsubscribe_token: `tok_${Math.random().toString(36).substring(2, 12)}`,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    contactsDb.unshift(newContact)
    res.status(201).json(newContact)
  })

  // PATCH /api/contacts/:id — update contact or status
  router.patch('/api/contacts/:id', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { id } = req.params
    const contact = contactsDb.find((c) => c.id === id)
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    const { status, email, first_name, last_name, organization, job_role, audience_tag } = req.body || {}

    // Enforce RBAC: Only marketing_lead and administrator can manually suppress or reactivate contacts
    if (status && status !== contact.status) {
      if (status === 'suppressed' || contact.status === 'suppressed') {
        const checkLead = requireMinimumRole('marketing_lead')(req, res)
        if (!checkLead) return
      }
      contact.status = status
    }

    if (email && email.trim().toLowerCase() !== contact.email.toLowerCase()) {
      const normEmail = email.trim().toLowerCase()
      if (contactsDb.some((c) => c.id !== id && c.email.toLowerCase() === normEmail)) {
        res.status(409).json({ error: `Email "${normEmail}" is already used by another contact.` })
        return
      }
      contact.email = normEmail
    }

    if (first_name !== undefined) contact.first_name = first_name
    if (last_name !== undefined) contact.last_name = last_name
    if (organization !== undefined) contact.organization = organization
    if (job_role !== undefined) contact.job_role = job_role
    if (audience_tag !== undefined) contact.audience_tag = audience_tag
    contact.updated_at = new Date().toISOString()

    res.status(200).json(contact)
  })
}
