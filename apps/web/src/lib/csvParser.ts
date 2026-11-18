import type { Contact, ContactStatus } from '../types'

export interface ParsedContactRow {
  email: string
  first_name?: string
  last_name?: string
  organization?: string
  district?: string
  job_role?: string
  audience_tag?: string
}

export interface CsvRowError {
  rowNumber: number
  rawLine: string
  reason: string
}

export interface CsvImportAnalysis {
  validRows: ParsedContactRow[]
  skippedDuplicates: string[]
  invalidRows: CsvRowError[]
  suppressedExistingEmails: string[]
  updatedContacts: string[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseCsvContent(
  csvText: string,
  existingContacts: Contact[],
  updateEmptyFields = false
): CsvImportAnalysis {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const result: CsvImportAnalysis = {
    validRows: [],
    skippedDuplicates: [],
    invalidRows: [],
    suppressedExistingEmails: [],
    updatedContacts: [],
  }

  if (lines.length < 2) {
    return result
  }

  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine).map((h) =>
    h.trim().toLowerCase().replace(/[\s_-]/g, '')
  )

  const emailIdx = headers.findIndex((h) => h === 'email')
  if (emailIdx === -1) {
    result.invalidRows.push({
      rowNumber: 1,
      rawLine: headerLine,
      reason: 'Required column "email" missing from CSV header.',
    })
    return result
  }

  const firstNameIdx = headers.findIndex((h) => h === 'firstname' || h === 'first')
  const lastNameIdx = headers.findIndex((h) => h === 'lastname' || h === 'last')
  const orgIdx = headers.findIndex(
    (h) => h === 'organization' || h === 'org' || h === 'school' || h === 'schoolname' || h === 'campus'
  )
  const districtIdx = headers.findIndex(
    (h) => h === 'district' || h === 'schooldistrict' || h === 'isd' || h === 'county'
  )
  const roleIdx = headers.findIndex((h) => h === 'jobrole' || h === 'role' || h === 'title')
  const audienceIdx = headers.findIndex(
    (h) => h === 'audiencetag' || h === 'audience' || h === 'tag'
  )

  const existingMap = new Map<string, Contact>()
  existingContacts.forEach((c) => existingMap.set(c.email.toLowerCase(), c))

  const seenInBatch = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    const cols = parseCsvLine(rawLine)
    const rowNumber = i + 1

    const rawEmail = cols[emailIdx]?.trim() || ''
    const normalizedEmail = rawEmail.toLowerCase()

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      result.invalidRows.push({
        rowNumber,
        rawLine,
        reason: rawEmail ? `Invalid email address format: "${rawEmail}"` : 'Missing email address.',
      })
      continue
    }

    if (seenInBatch.has(normalizedEmail)) {
      result.skippedDuplicates.push(normalizedEmail)
      continue
    }
    seenInBatch.add(normalizedEmail)

    const row: ParsedContactRow = {
      email: normalizedEmail,
      first_name: firstNameIdx !== -1 ? cols[firstNameIdx]?.trim() || undefined : undefined,
      last_name: lastNameIdx !== -1 ? cols[lastNameIdx]?.trim() || undefined : undefined,
      organization: orgIdx !== -1 ? cols[orgIdx]?.trim() || undefined : undefined,
      district: districtIdx !== -1 ? cols[districtIdx]?.trim() || undefined : undefined,
      job_role: roleIdx !== -1 ? cols[roleIdx]?.trim() || undefined : undefined,
      audience_tag: audienceIdx !== -1 ? cols[audienceIdx]?.trim() || undefined : undefined,
    }

    const existingContact = existingMap.get(normalizedEmail)
    if (existingContact) {
      const nonActiveStatuses: ContactStatus[] = ['unsubscribed', 'bounced', 'suppressed']
      if (nonActiveStatuses.includes(existingContact.status)) {
        result.suppressedExistingEmails.push(normalizedEmail)
        continue
      }

      if (updateEmptyFields) {
        const hasNewInfo = Boolean(
          (row.first_name && row.first_name !== existingContact.first_name) ||
          (row.last_name && row.last_name !== existingContact.last_name) ||
          (row.organization && row.organization !== existingContact.organization) ||
          (row.district && row.district !== existingContact.district) ||
          (row.job_role && row.job_role !== existingContact.job_role) ||
          (row.audience_tag && row.audience_tag !== existingContact.audience_tag)
        )

        if (hasNewInfo) {
          result.updatedContacts.push(normalizedEmail)
          result.validRows.push(row)
          continue
        }
      }

      result.skippedDuplicates.push(normalizedEmail)
      continue
    }

    result.validRows.push(row)
  }

  return result
}

function parseCsvLine(text: string): string[] {
  const result: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  result.push(cell)
  return result
}
