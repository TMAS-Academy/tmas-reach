import { describe, it, expect } from 'vitest'
import { validateSurveySubmission, surveySubmissionsToCsv, getBlankCsvTemplate } from '../surveyEngine'
import { parseCsvContent } from '../csvParser'
import type { SurveySubmission } from '../../types/survey'

describe('surveyEngine - validation', () => {
  const validData: Partial<SurveySubmission> = {
    email: 'educator@district.edu',
    first_name: 'Alex',
    last_name: 'Rivera',
    organization: 'Westside STEM High School',
    job_role: 'AP Calculus Teacher',
    audience_tag: 'high_school',
    consent_outreach: true,
  }

  it('passes validation with all required educator survey fields', () => {
    const result = validateSurveySubmission(validData)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when email is missing or malformed', () => {
    const emptyEmail = validateSurveySubmission({ ...validData, email: '' })
    expect(emptyEmail.valid).toBe(false)
    expect(emptyEmail.errors.some((e) => e.field === 'email')).toBe(true)

    const invalidEmail = validateSurveySubmission({ ...validData, email: 'not-an-email' })
    expect(invalidEmail.valid).toBe(false)
    expect(invalidEmail.errors.some((e) => e.field === 'email')).toBe(true)
  })

  it('fails when required name or organization fields are missing', () => {
    const missingFirst = validateSurveySubmission({ ...validData, first_name: '  ' })
    expect(missingFirst.valid).toBe(false)
    expect(missingFirst.errors.some((e) => e.field === 'first_name')).toBe(true)

    const missingOrg = validateSurveySubmission({ ...validData, organization: '' })
    expect(missingOrg.valid).toBe(false)
    expect(missingOrg.errors.some((e) => e.field === 'organization')).toBe(true)

    const missingRole = validateSurveySubmission({ ...validData, job_role: '' })
    expect(missingRole.valid).toBe(false)
    expect(missingRole.errors.some((e) => e.field === 'job_role')).toBe(true)
  })

  it('fails when audience tag or consent is missing', () => {
    const noConsent = validateSurveySubmission({ ...validData, consent_outreach: false })
    expect(noConsent.valid).toBe(false)
    expect(noConsent.errors.some((e) => e.field === 'consent_outreach')).toBe(true)

    const noAudience = validateSurveySubmission({ ...validData, audience_tag: undefined })
    expect(noAudience.valid).toBe(false)
    expect(noAudience.errors.some((e) => e.field === 'audience_tag')).toBe(true)
  })

  it('provides a clean blank CSV template header matching TMAS specification', () => {
    const template = getBlankCsvTemplate()
    expect(template).toContain('email,first_name,last_name,organization,job_role,audience_tag')
    expect(template).toContain('high_school')
  })
})

describe('surveyEngine - CSV serialization', () => {
  const sampleSubmissions: SurveySubmission[] = [
    {
      id: 'sub_1',
      email: 'Principal.Jones@School.ORG',
      first_name: 'Jordan',
      last_name: 'Jones, Jr.',
      organization: 'Lincoln Academy "A"',
      job_role: 'Head of STEM',
      audience_tag: 'district_admin',
      grade_levels: ['9-12'],
      notes: 'Interested in math curriculum',
      consent_outreach: true,
      status: 'pending_review',
      submitted_at: '2026-11-17T09:00:00Z',
    },
    {
      id: 'sub_2',
      email: 'teacher@elementary.edu',
      first_name: 'Taylor',
      last_name: 'Smith',
      organization: 'Oakridge School',
      job_role: 'Math Coach',
      audience_tag: 'educators',
      grade_levels: ['K-5'],
      consent_outreach: true,
      status: 'pending_review',
      submitted_at: '2026-11-17T09:30:00Z',
    },
  ]

  it('serializes survey submissions to valid CSV format with exact expected headers', () => {
    const csv = surveySubmissionsToCsv(sampleSubmissions)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('email,first_name,last_name,organization,job_role,audience_tag')
    expect(lines).toHaveLength(3)
  })

  it('normalizes email casing and escapes double quotes and special characters', () => {
    const csv = surveySubmissionsToCsv(sampleSubmissions)
    expect(csv).toContain('"principal.jones@school.org"')
    expect(csv).toContain('"Lincoln Academy ""A"""')
    expect(csv).toContain('"Jones, Jr."')
  })

  it('produces CSV that is strictly parseable by TMAS Reach CSV parser', () => {
    const csv = surveySubmissionsToCsv(sampleSubmissions)
    const parseResult = parseCsvContent(csv, [])

    expect(parseResult.invalidRows).toHaveLength(0)
    expect(parseResult.validRows).toHaveLength(2)
    expect(parseResult.validRows[0].email).toBe('principal.jones@school.org')
    expect(parseResult.validRows[0].first_name).toBe('Jordan')
    expect(parseResult.validRows[0].last_name).toBe('Jones, Jr.')
    expect(parseResult.validRows[0].organization).toBe('Lincoln Academy "A"')
    expect(parseResult.validRows[0].job_role).toBe('Head of STEM')
    expect(parseResult.validRows[0].audience_tag).toBe('district_admin')
  })
})
