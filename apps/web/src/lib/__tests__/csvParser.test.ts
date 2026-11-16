import { describe, it, expect } from 'vitest'
import { parseCsvContent } from '../csvParser'
import type { Contact } from '../../types'

describe('CSV Parser and Import Validator', () => {
  const existingContacts: Contact[] = [
    {
      id: 'c1',
      email: 'active@school.edu',
      status: 'active',
      unsubscribe_token: 'tok-1',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'c2',
      email: 'optout@school.edu',
      status: 'unsubscribed',
      unsubscribe_token: 'tok-2',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'c3',
      email: 'bounced@school.edu',
      status: 'bounced',
      unsubscribe_token: 'tok-3',
      created_at: '',
      updated_at: '',
    },
  ]

  it('rejects CSV when email column is missing from header', () => {
    const csv = 'first_name,last_name,organization\nJohn,Doe,Central High'
    const res = parseCsvContent(csv, existingContacts)
    expect(res.validRows.length).toBe(0)
    expect(res.invalidRows.length).toBe(1)
    expect(res.invalidRows[0].reason).toContain('email')
  })

  it('normalizes whitespace and lowercases email', () => {
    const csv = 'email,first_name,organization\n  TEACHER@School.EDU  , Maria ,  Lincoln HS  '
    const res = parseCsvContent(csv, existingContacts)
    expect(res.validRows.length).toBe(1)
    expect(res.validRows[0].email).toBe('teacher@school.edu')
    expect(res.validRows[0].first_name).toBe('Maria')
    expect(res.validRows[0].organization).toBe('Lincoln HS')
  })

  it('detects and flags invalid email syntax', () => {
    const csv = 'email,first_name\nnot-an-email,Bob\nvalid@domain.org,Alice\n@missinguser.com,Dan'
    const res = parseCsvContent(csv, existingContacts)
    expect(res.validRows.length).toBe(1)
    expect(res.validRows[0].email).toBe('valid@domain.org')
    expect(res.invalidRows.length).toBe(2)
  })

  it('skips duplicate emails by default', () => {
    const csv = 'email,first_name\nactive@school.edu,Duplicate\nnew@school.edu,New User'
    const res = parseCsvContent(csv, existingContacts, false)
    expect(res.validRows.length).toBe(1)
    expect(res.validRows[0].email).toBe('new@school.edu')
    expect(res.skippedDuplicates).toContain('active@school.edu')
  })

  it('strictly protects unsubscribed and bounced contacts from reactivation', () => {
    const csv = 'email,first_name\noptout@school.edu,Reactivated?\nbounced@school.edu,Retry?'
    const res = parseCsvContent(csv, existingContacts, true)
    expect(res.validRows.length).toBe(0)
    expect(res.suppressedExistingEmails).toContain('optout@school.edu')
    expect(res.suppressedExistingEmails).toContain('bounced@school.edu')
  })
})
