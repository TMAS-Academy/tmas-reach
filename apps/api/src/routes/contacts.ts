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

  // POST /api/contacts/import — bulk CSV ingestion with deduplication and suppression guards
  router.post('/api/contacts/import', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { csvContent, updateEmptyFields = false } = req.body || {}
    if (!csvContent || typeof csvContent !== 'string') {
      res.status(400).json({ error: 'csvContent string is required.' })
      return
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))

    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV must contain a header line and at least one data row.' })
      return
    }

    const headerParts = lines[0].split(',').map((h) => h.replace(/["'\s]/g, '').toLowerCase())
    const emailIndex = headerParts.indexOf('email')
    if (emailIndex === -1) {
      res.status(400).json({ error: 'CSV is missing required "email" column.' })
      return
    }

    const firstNameIdx = headerParts.indexOf('first_name')
    const lastNameIdx = headerParts.indexOf('last_name')
    const orgIdx = headerParts.indexOf('organization')
    const roleIdx = headerParts.indexOf('job_role')
    const audienceIdx = headerParts.indexOf('audience_tag')

    const createdContacts: ContactRecord[] = []
    const skippedDuplicates: string[] = []
    const suppressedBlocked: string[] = []
    const invalidRows: { line: number; raw: string; error: string }[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim())
      const email = cols[emailIndex]?.toLowerCase()

      if (!email || !email.includes('@')) {
        invalidRows.push({ line: i + 1, raw: line, error: 'Invalid or missing email address.' })
        continue
      }

      // Check if email already suppressed or bounced
      const existing = contactsDb.find((c) => c.email.toLowerCase() === email)
      if (existing) {
        if (existing.status === 'suppressed' || existing.status === 'bounced' || existing.status === 'unsubscribed') {
          suppressedBlocked.push(email)
          continue
        }

        if (updateEmptyFields) {
          if (firstNameIdx !== -1 && !existing.first_name && cols[firstNameIdx]) existing.first_name = cols[firstNameIdx]
          if (lastNameIdx !== -1 && !existing.last_name && cols[lastNameIdx]) existing.last_name = cols[lastNameIdx]
          if (orgIdx !== -1 && !existing.organization && cols[orgIdx]) existing.organization = cols[orgIdx]
          if (roleIdx !== -1 && !existing.job_role && cols[roleIdx]) existing.job_role = cols[roleIdx]
          if (audienceIdx !== -1 && !existing.audience_tag && cols[audienceIdx]) existing.audience_tag = cols[audienceIdx]
          existing.updated_at = new Date().toISOString()
        }

        skippedDuplicates.push(email)
        continue
      }

      const newContact: ContactRecord = {
        id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email,
        first_name: firstNameIdx !== -1 ? cols[firstNameIdx] : '',
        last_name: lastNameIdx !== -1 ? cols[lastNameIdx] : '',
        organization: orgIdx !== -1 ? cols[orgIdx] : '',
        job_role: roleIdx !== -1 ? cols[roleIdx] : '',
        audience_tag: audienceIdx !== -1 ? cols[audienceIdx] : 'educators',
        status: 'active',
        unsubscribe_token: `tok_${Math.random().toString(36).substring(2, 12)}`,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      contactsDb.unshift(newContact)
      createdContacts.push(newContact)
    }

    res.status(200).json({
      summary: {
        totalRows: lines.length - 1,
        importedCount: createdContacts.length,
        skippedDuplicatesCount: skippedDuplicates.length,
        suppressedBlockedCount: suppressedBlocked.length,
        invalidRowsCount: invalidRows.length,
      },
      createdContacts,
      skippedDuplicates,
      suppressedBlocked,
      invalidRows,
    })
  })
}
