import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store'

describe('surveyStore - intake lifecycle and contact promotion', () => {
  beforeEach(() => {
    store.resetToDefault()
  })

  it('stores a new survey submission in pending_review status', () => {
    const submission = store.addSurveySubmission({
      email: 'Principal.Patel@school.edu',
      first_name: 'Priya',
      last_name: 'Patel',
      organization: 'Central Academy',
      job_role: 'STEM Director',
      audience_tag: 'district_admin',
      grade_levels: ['9-12'],
      estimated_students: 450,
      notes: 'Excited about math olympiad partnership',
      consent_outreach: true,
    })

    expect(submission.id).toBeDefined()
    expect(submission.email).toBe('principal.patel@school.edu')
    expect(submission.status).toBe('pending_review')

    const surveys = store.getSurveys()
    expect(surveys.some((s) => s.id === submission.id)).toBe(true)
  })

  it('promotes a pending survey submission to active contact', () => {
    const submission = store.addSurveySubmission({
      email: 'dr.smith@metro.k12.us',
      first_name: 'Taylor',
      last_name: 'Smith',
      organization: 'Metro High School',
      job_role: 'Math Department Lead',
      audience_tag: 'high_school',
      grade_levels: ['9-12'],
      consent_outreach: true,
    })

    const promoteRes = store.promoteSurveyToContact(submission.id)
    expect(promoteRes.success).toBe(true)

    // Verify contact list now has Taylor Smith
    const contacts = store.getContacts()
    const newContact = contacts.find((c) => c.email === 'dr.smith@metro.k12.us')
    expect(newContact).toBeDefined()
    expect(newContact?.first_name).toBe('Taylor')
    expect(newContact?.organization).toBe('Metro High School')
    expect(newContact?.status).toBe('active')

    // Verify survey status changed to imported_to_contacts
    const updatedSurvey = store.getSurveys().find((s) => s.id === submission.id)
    expect(updatedSurvey?.status).toBe('imported_to_contacts')
  })

  it('prevents promoting duplicate contact if email already exists in contacts', () => {
    // Add contact directly
    store.addContact({
      email: 'existing.educator@school.edu',
      first_name: 'Existing',
      last_name: 'Educator',
      organization: 'Westside High',
      job_role: 'Teacher',
      audience_tag: 'high_school',
      status: 'active',
    })

    // Survey with duplicate email
    const duplicateSurvey = store.addSurveySubmission({
      email: 'EXISTING.EDUCATOR@school.edu',
      first_name: 'Existing',
      last_name: 'Educator',
      organization: 'Westside High',
      job_role: 'Teacher',
      audience_tag: 'high_school',
      consent_outreach: true,
    })

    const promoteRes = store.promoteSurveyToContact(duplicateSurvey.id)
    expect(promoteRes.success).toBe(false)
    expect(promoteRes.error).toContain('already exists')
  })

  it('archives survey submissions', () => {
    const submission = store.addSurveySubmission({
      email: 'outdated@school.edu',
      first_name: 'Old',
      last_name: 'Lead',
      organization: 'Old District',
      job_role: 'Former Coordinator',
      audience_tag: 'educators',
      consent_outreach: true,
    })

    store.archiveSurvey(submission.id)
    const archived = store.getSurveys().find((s) => s.id === submission.id)
    expect(archived?.status).toBe('archived')
  })
})
