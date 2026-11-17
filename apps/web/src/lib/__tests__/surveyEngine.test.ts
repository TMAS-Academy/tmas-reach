import { describe, it, expect } from 'vitest'
import { validateSurveySubmission, getBlankCsvTemplate } from '../surveyEngine'
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
