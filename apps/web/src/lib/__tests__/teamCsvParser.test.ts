import { describe, it, expect } from 'vitest'
import { parseTeamCsvContent, normalizeUserRole } from '../teamCsvParser'

describe('Team CSV Parser', () => {
  it('normalizes roles across common synonyms', () => {
    expect(normalizeUserRole('admin')).toBe('administrator')
    expect(normalizeUserRole('Administrator')).toBe('administrator')
    expect(normalizeUserRole('lead')).toBe('marketing_lead')
    expect(normalizeUserRole('Marketing Lead')).toBe('marketing_lead')
    expect(normalizeUserRole('manager')).toBe('marketing_lead')
    expect(normalizeUserRole('intern')).toBe('marketing_intern')
    expect(normalizeUserRole('marketing_intern')).toBe('marketing_intern')
    expect(normalizeUserRole('')).toBe('marketing_intern')
  })

  it('parses valid team rows with varied personal/university email domains', () => {
    const csv = `email,name,role
sarah.outreach@gmail.com,Sarah Jenkins,intern
marcus.t@berkeley.edu,Marcus Torres,lead
alex.admin@outlook.com,Alex Rivera,administrator
dev@protonmail.com,Dev User,marketing_lead`

    const res = parseTeamCsvContent(csv)
    expect(res.validRows.length).toBe(4)
    expect(res.invalidRows.length).toBe(0)

    expect(res.validRows[0]).toEqual({
      email: 'sarah.outreach@gmail.com',
      full_name: 'Sarah Jenkins',
      role: 'marketing_intern',
    })
    expect(res.validRows[1]).toEqual({
      email: 'marcus.t@berkeley.edu',
      full_name: 'Marcus Torres',
      role: 'marketing_lead',
    })
    expect(res.validRows[2]).toEqual({
      email: 'alex.admin@outlook.com',
      full_name: 'Alex Rivera',
      role: 'administrator',
    })
    expect(res.validRows[3]).toEqual({
      email: 'dev@protonmail.com',
      full_name: 'Dev User',
      role: 'marketing_lead',
    })
  })

  it('detects missing email header', () => {
    const csv = `name,role\nSarah,intern`
    const res = parseTeamCsvContent(csv)
    expect(res.validRows.length).toBe(0)
    expect(res.invalidRows[0].reason).toContain('Required column "email"')
  })

  it('flags invalid email rows and deduplicates emails in batch', () => {
    const csv = `email,name,role
invalid-email,Bad User,intern
user1@gmail.com,User One,intern
user1@gmail.com,User Duplicate,lead`

    const res = parseTeamCsvContent(csv)
    expect(res.validRows.length).toBe(1)
    expect(res.invalidRows.length).toBe(1)
    expect(res.skippedDuplicates).toContain('user1@gmail.com')
  })
})
