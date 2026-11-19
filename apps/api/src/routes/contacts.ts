import crypto from 'node:crypto'
import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { requireAuth, requireMinimumRole } from '../middleware/rbac.js'
import { campaignRecipientsDb } from './campaigns.js'
import { appendActivityLog } from './logs.js'

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

const VALID_CONTACT_STATUSES = new Set<ContactStatus>([
  'active',
  'unsubscribed',
  'bounced',
  'suppressed',
])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function generateContactId(): string {
  return `cnt_${crypto.randomUUID()}`
}

export function generateUnsubscribeToken(): string {
  return `tok_${crypto.randomBytes(16).toString('hex')}`
}

// RFC-4180 compliant CSV parser handling quoted fields, embedded commas, escaped quotes, and CRLF/LF.
export function parseCsvRecords(csvContent: string): string[][] {
  const input = csvContent.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      currentField = ''
      const isNonEmpty = currentRow.some((cell) => cell.length > 0)
      const isComment = currentRow.length === 1 && currentRow[0].startsWith('#')
      if (isNonEmpty && !isComment) {
        rows.push(currentRow)
      }
      currentRow = []
    } else {
      currentField += ch
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    const isNonEmpty = currentRow.some((cell) => cell.length > 0)
    const isComment = currentRow.length === 1 && currentRow[0].startsWith('#')
    if (isNonEmpty && !isComment) {
      rows.push(currentRow)
    }
  }

  return rows
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

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 25))
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

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      res.status(400).json({ error: 'A valid email is required' })
      return
    }

    const normEmail = email.trim().toLowerCase()
    const existing = contactsDb.find((c) => c.email.toLowerCase() === normEmail)
    if (existing) {
      res.status(409).json({ error: `Contact with email "${normEmail}" already exists.` })
      return
    }

    const now = new Date().toISOString()
    const newContact: ContactRecord = {
      id: generateContactId(),
      email: normEmail,
      first_name: typeof first_name === 'string' ? first_name.trim() : '',
      last_name: typeof last_name === 'string' ? last_name.trim() : '',
      organization: typeof organization === 'string' ? organization.trim() : '',
      job_role: typeof job_role === 'string' ? job_role.trim() : '',
      audience_tag: typeof audience_tag === 'string' && audience_tag.trim() ? audience_tag.trim() : 'educators',
      status: 'active',
      unsubscribe_token: generateUnsubscribeToken(),
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }

    contactsDb.unshift(newContact)
    appendActivityLog({
      actor_id: user.id,
      action: 'contact.created',
      entity_type: 'contact',
      entity_id: newContact.id,
      metadata: { email: newContact.email, audience_tag: newContact.audience_tag },
    })
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

    if (status !== undefined) {
      if (typeof status !== 'string' || !VALID_CONTACT_STATUSES.has(status as ContactStatus)) {
        res.status(400).json({ error: 'Invalid contact status.' })
        return
      }
      if (status !== contact.status) {
        // Only marketing_lead and administrator can manually suppress or reactivate suppressed/unsubscribed/bounced contacts
        if (
          status === 'suppressed' ||
          contact.status === 'suppressed' ||
          (status === 'active' && contact.status !== 'active')
        ) {
          const checkLead = requireMinimumRole('marketing_lead')(req, res)
          if (!checkLead) return
        }
        contact.status = status as ContactStatus
      }
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
        res.status(400).json({ error: 'A valid email is required' })
        return
      }
      const normEmail = email.trim().toLowerCase()
      if (normEmail !== contact.email.toLowerCase()) {
        if (contactsDb.some((c) => c.id !== id && c.email.toLowerCase() === normEmail)) {
          res.status(409).json({ error: `Email "${normEmail}" is already used by another contact.` })
          return
        }
        contact.email = normEmail
      }
    }

    if (first_name !== undefined) contact.first_name = String(first_name).trim()
    if (last_name !== undefined) contact.last_name = String(last_name).trim()
    if (organization !== undefined) contact.organization = String(organization).trim()
    if (job_role !== undefined) contact.job_role = String(job_role).trim()
    if (audience_tag !== undefined) contact.audience_tag = String(audience_tag).trim()
    contact.updated_at = new Date().toISOString()

    appendActivityLog({
      actor_id: user.id,
      action: 'contact.updated',
      entity_type: 'contact',
      entity_id: contact.id,
      metadata: { status: contact.status },
    })

    res.status(200).json(contact)
  })

  // DELETE /api/contacts/:id — Marketing Lead / Administrator contact deletion
  router.delete('/api/contacts/:id', (req: ApiRequest, res: ApiResponse) => {
    const user = requireMinimumRole('marketing_lead')(req, res)
    if (!user) return

    const { id } = req.params
    const idx = contactsDb.findIndex((c) => c.id === id)
    if (idx === -1) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    const [removed] = contactsDb.splice(idx, 1)
    let cancelledQueued = 0
    for (const r of campaignRecipientsDb) {
      if (r.contact_id === removed.id && r.delivery_status === 'queued') {
        r.delivery_status = 'skipped_suppressed'
        cancelledQueued++
      }
    }

    appendActivityLog({
      actor_id: user.id,
      action: 'contact.deleted',
      entity_type: 'contact',
      entity_id: removed.id,
      metadata: { email: removed.email, cancelledQueued },
    })

    res.status(200).json({
      deleted: true,
      id: removed.id,
      cancelledQueued,
    })
  })

  // POST /api/contacts/import — bulk CSV ingestion with RFC-4180 parsing, deduplication, and suppression guards
  router.post('/api/contacts/import', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { csvContent, updateEmptyFields = false } = req.body || {}
    if (!csvContent || typeof csvContent !== 'string') {
      res.status(400).json({ error: 'csvContent string is required.' })
      return
    }

    const records = parseCsvRecords(csvContent)
    if (records.length < 2) {
      res.status(400).json({ error: 'CSV must contain a header line and at least one data row.' })
      return
    }

    const headerParts = records[0].map((h) => h.replace(/["'\s]/g, '').toLowerCase())
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

    for (let i = 1; i < records.length; i++) {
      const cols = records[i]
      const email = (cols[emailIndex] || '').trim().toLowerCase()

      if (!email || !EMAIL_REGEX.test(email)) {
        invalidRows.push({
          line: i + 1,
          raw: cols.join(','),
          error: 'Invalid or missing email address.',
        })
        continue
      }

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

      const now = new Date().toISOString()
      const newContact: ContactRecord = {
        id: generateContactId(),
        email,
        first_name: firstNameIdx !== -1 ? cols[firstNameIdx] || '' : '',
        last_name: lastNameIdx !== -1 ? cols[lastNameIdx] || '' : '',
        organization: orgIdx !== -1 ? cols[orgIdx] || '' : '',
        job_role: roleIdx !== -1 ? cols[roleIdx] || '' : '',
        audience_tag: audienceIdx !== -1 && cols[audienceIdx] ? cols[audienceIdx] : 'educators',
        status: 'active',
        unsubscribe_token: generateUnsubscribeToken(),
        created_by: user.id,
        created_at: now,
        updated_at: now,
      }

      contactsDb.unshift(newContact)
      createdContacts.push(newContact)
    }

    appendActivityLog({
      actor_id: user.id,
      action: 'contacts.imported',
      entity_type: 'contact',
      metadata: {
        totalRows: records.length - 1,
        importedCount: createdContacts.length,
        skippedDuplicatesCount: skippedDuplicates.length,
        suppressedBlockedCount: suppressedBlocked.length,
        invalidRowsCount: invalidRows.length,
      },
    })

    res.status(200).json({
      summary: {
        totalRows: records.length - 1,
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
