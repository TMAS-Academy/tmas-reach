import type { SurveySubmission, SurveyValidationError } from '../types/survey'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSurveySubmission(
  data: Partial<SurveySubmission>
): { valid: boolean; errors: SurveyValidationError[] } {
  const errors: SurveyValidationError[] = []

  if (!data.email || !data.email.trim()) {
    errors.push({ field: 'email', message: 'School/work email is required.' })
  } else if (!EMAIL_REGEX.test(data.email.trim().toLowerCase())) {
    errors.push({ field: 'email', message: 'Please provide a valid email address.' })
  }

  if (!data.first_name || !data.first_name.trim()) {
    errors.push({ field: 'first_name', message: 'First name is required.' })
  }

  if (!data.last_name || !data.last_name.trim()) {
    errors.push({ field: 'last_name', message: 'Last name is required.' })
  }

  if (!data.organization || !data.organization.trim()) {
    errors.push({ field: 'organization', message: 'School or district organization is required.' })
  }

  if (!data.job_role || !data.job_role.trim()) {
    errors.push({ field: 'job_role', message: 'Role or title is required.' })
  }

  if (!data.audience_tag) {
    errors.push({ field: 'audience_tag', message: 'Target audience level is required.' })
  }

  if (!data.consent_outreach) {
    errors.push({
      field: 'consent_outreach',
      message: 'Consent is required to receive TMAS Academy outreach.',
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function surveySubmissionsToCsv(submissions: SurveySubmission[]): string {
  const headers = 'email,first_name,last_name,organization,job_role,audience_tag'
  const rows = submissions.map((s) => {
    const email = s.email.trim().toLowerCase()
    const first = s.first_name.trim().replace(/"/g, '""')
    const last = s.last_name.trim().replace(/"/g, '""')
    const org = s.organization.trim().replace(/"/g, '""')
    const role = s.job_role.trim().replace(/"/g, '""')
    const audience = s.audience_tag
    return `"${email}","${first}","${last}","${org}","${role}","${audience}"`
  })

  return [headers, ...rows].join('\n')
}

export function getBlankCsvTemplate(): string {
  return [
    'email,first_name,last_name,organization,job_role,audience_tag',
    '# Note: email is required. Audience tags can be: high_school, middle_school, district_admin, educators, nonprofit',
    'math.chair@school.edu,Firstname,Lastname,Lincoln High School,Math Department Chair,high_school',
  ].join('\n')
}
