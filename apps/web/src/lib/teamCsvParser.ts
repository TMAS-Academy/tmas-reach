import type { UserRole } from '../types'

export interface ParsedTeamUserRow {
  email: string
  full_name: string
  role: UserRole
}

export interface TeamCsvRowError {
  rowNumber: number
  rawLine: string
  reason: string
}

export interface TeamCsvAnalysis {
  validRows: ParsedTeamUserRow[]
  invalidRows: TeamCsvRowError[]
  skippedDuplicates: string[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeUserRole(rawRole?: string): UserRole {
  if (!rawRole) return 'marketing_intern'
  const norm = rawRole.trim().toLowerCase().replace(/[\s_-]/g, '')
  if (norm.includes('admin')) return 'administrator'
  if (norm.includes('lead') || norm.includes('manager') || norm.includes('director')) {
    return 'marketing_lead'
  }
  return 'marketing_intern'
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function parseTeamCsvContent(csvText: string): TeamCsvAnalysis {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const result: TeamCsvAnalysis = {
    validRows: [],
    invalidRows: [],
    skippedDuplicates: [],
  }

  if (lines.length < 2) {
    return result
  }

  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine).map((h) =>
    h.trim().toLowerCase().replace(/[\s_-]/g, '')
  )

  const emailIdx = headers.findIndex((h) => h === 'email' || h === 'useremail')
  const nameIdx = headers.findIndex(
    (h) => h === 'name' || h === 'fullname' || h === 'member' || h === 'user'
  )
  const roleIdx = headers.findIndex((h) => h === 'role' || h === 'userrole' || h === 'title')

  if (emailIdx === -1) {
    result.invalidRows.push({
      rowNumber: 1,
      rawLine: headerLine,
      reason: 'Required column "email" missing from CSV header.',
    })
    return result
  }

  const seenEmails = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    if (rawLine.startsWith('#')) continue // comment line

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

    if (seenEmails.has(normalizedEmail)) {
      result.skippedDuplicates.push(normalizedEmail)
      continue
    }
    seenEmails.add(normalizedEmail)

    const rawName = nameIdx !== -1 ? cols[nameIdx]?.trim() : ''
    const rawRole = roleIdx !== -1 ? cols[roleIdx]?.trim() : ''

    const role = normalizeUserRole(rawRole)
    const fullName = rawName || normalizedEmail.split('@')[0]

    result.validRows.push({
      email: normalizedEmail,
      full_name: fullName,
      role,
    })
  }

  return result
}

export function getSampleTeamCsv(): string {
  return [
    'email,name,role',
    'sarah.outreach@gmail.com,Sarah Jenkins,marketing_intern',
    'marcus.t@berkeley.edu,Marcus Torres,marketing_lead',
    'alex.admin@outlook.com,Alex Rivera,administrator',
  ].join('\n')
}
