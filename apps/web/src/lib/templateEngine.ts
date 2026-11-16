import { Contact, EmailTemplate } from '../types'

export interface RenderContext {
  contact?: Partial<Contact>
  unsubscribeUrl?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const KNOWN_VARIABLES = [
  'first_name',
  'last_name',
  'organization',
  'job_role',
  'unsubscribe_url',
]

export function renderTemplateString(
  template: string,
  context: RenderContext = {}
): string {
  const { contact = {}, unsubscribeUrl = 'https://reach.tmasacademy.org/unsubscribe/sample-token' } = context

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    switch (key) {
      case 'first_name':
        return contact.first_name?.trim() || 'Educator'
      case 'last_name':
        return contact.last_name?.trim() || ''
      case 'organization':
        return contact.organization?.trim() || 'your school'
      case 'job_role':
        return contact.job_role?.trim() || ''
      case 'unsubscribe_url':
        return unsubscribeUrl
      default:
        return `{{${key}}}`
    }
  })
}

export function validateCampaignPreApproval(
  template: EmailTemplate,
  targetActiveContactsCount: number
): ValidationResult {
  const errors: string[] = []

  if (!template.subject_template || template.subject_template.trim() === '') {
    errors.push('Subject template cannot be empty.')
  }

  const hasBodyHtml = template.body_html && template.body_html.trim() !== ''
  const hasBodyText = template.body_text && template.body_text.trim() !== ''

  if (!hasBodyHtml && !hasBodyText) {
    errors.push('Template body cannot be empty.')
  }

  const fullBody = `${template.body_html || ''} ${template.body_text || ''}`
  if (!fullBody.includes('{{unsubscribe_url}}')) {
    errors.push('Template body must contain the {{unsubscribe_url}} tag for compliance.')
  }

  if (targetActiveContactsCount < 1) {
    errors.push('Target audience resolves to 0 active contacts. At least 1 active contact is required.')
  }

  const allText = `${template.subject_template} ${fullBody}`
  const matches = allText.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []
  for (const match of matches) {
    const varName = match.replace(/[{}]/g, '').trim()
    if (!KNOWN_VARIABLES.includes(varName)) {
      errors.push(`Unrecognized template variable: {{${varName}}}`)
    }
  }

  const malformed = allText.match(/\{[^{}]*\}|\{\{[^}]*$/)
  if (malformed && !malformed[0].startsWith('{{') && malformed[0].endsWith('}}')) {
    errors.push('Malformed variable tag found in template.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
