import { describe, it, expect } from 'vitest'
import { renderTemplateString, validateCampaignPreApproval } from '../templateEngine'
import type { Contact, EmailTemplate } from '../../types'

describe('emptyStateHandling - safe behavior with zero seed contacts', () => {
  it('interpolates template with fallback labels when contact data is empty', () => {
    const template = 'Hello {{first_name}}, welcome to TMAS Academy from {{organization}}!'
    const emptyContact: Contact = {
      id: '',
      email: '',
      status: 'active',
      unsubscribe_token: '',
      created_by: '',
      created_at: '',
      updated_at: '',
    }

    const rendered = renderTemplateString(template, { contact: emptyContact })
    expect(rendered).toBe('Hello Educator, welcome to TMAS Academy from your school!')
  })

  it('rejects campaign pre-approval when active contacts count is 0', () => {
    const sampleTemplate: EmailTemplate = {
      id: 'tmpl_1',
      name: 'High School Math Outreach',
      subject_template: 'Math Olympiad for {{organization}}',
      body_html: '',
      body_text: 'Hello {{first_name}}, join us at TMAS Academy. Unsubscribe: {{unsubscribe_url}}',
      created_by: 'usr_1',
      created_at: '2026-11-17T00:00:00Z',
      updated_at: '2026-11-17T00:00:00Z',
    }

    const validation = validateCampaignPreApproval(sampleTemplate, 0)
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain(
      'Target audience resolves to 0 active contacts. At least 1 active contact is required.'
    )
  })

  it('safely handles filtering and target counts with empty contact arrays', () => {
    const contacts: Contact[] = []
    const highSchoolRecipients = contacts.filter((c) => c.audience_tag === 'high_school')
    expect(highSchoolRecipients).toHaveLength(0)

    const canSubmitCampaign = highSchoolRecipients.length > 0
    expect(canSubmitCampaign).toBe(false)
  })
})
