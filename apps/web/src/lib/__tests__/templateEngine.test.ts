import { describe, it, expect } from 'vitest'
import { renderTemplateString, validateCampaignPreApproval } from '../templateEngine'
import type { EmailTemplate } from '../../types'

describe('Template Personalization Engine & Pre-Approval Checks', () => {
  it('interpolates variables with educator data', () => {
    const raw = 'Hello {{first_name}} {{last_name}}, welcome to {{organization}} as {{job_role}}!'
    const rendered = renderTemplateString(raw, {
      contact: {
        first_name: 'Elena',
        last_name: 'Rodriguez',
        organization: 'Oakridge High',
        job_role: 'Principal',
      },
    })
    expect(rendered).toBe('Hello Elena Rodriguez, welcome to Oakridge High as Principal!')
  })

  it('uses default fallbacks when fields are missing', () => {
    const raw = 'Hello {{first_name}}, partner with us at {{organization}}.'
    const rendered = renderTemplateString(raw, { contact: {} })
    expect(rendered).toBe('Hello Educator, partner with us at your school.')
  })

  it('fails pre-approval validation if {{unsubscribe_url}} is missing', () => {
    const template: EmailTemplate = {
      id: 't1',
      name: 'Missing Unsubscribe',
      subject_template: 'Math Program Outreach',
      body_html: '<p>Join our math contest!</p>',
      body_text: 'Join our math contest!',
      created_at: '',
      updated_at: '',
    }
    const res = validateCampaignPreApproval(template, 10)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('unsubscribe_url'))).toBe(true)
  })

  it('fails pre-approval validation if target audience has 0 active contacts', () => {
    const template: EmailTemplate = {
      id: 't2',
      name: 'Valid Template',
      subject_template: 'Outreach',
      body_html: '<p>Content</p><a href="{{unsubscribe_url}}">Unsubscribe</a>',
      body_text: 'Content {{unsubscribe_url}}',
      created_at: '',
      updated_at: '',
    }
    const res = validateCampaignPreApproval(template, 0)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes('0 active contacts'))).toBe(true)
  })

  it('passes pre-approval validation when all requirements are met', () => {
    const template: EmailTemplate = {
      id: 't3',
      name: 'Compliant Template',
      subject_template: 'Outreach for {{organization}}',
      body_html: '<p>Hello {{first_name}}</p><a href="{{unsubscribe_url}}">Opt out</a>',
      body_text: 'Hello {{first_name}} Opt out: {{unsubscribe_url}}',
      created_at: '',
      updated_at: '',
    }
    const res = validateCampaignPreApproval(template, 25)
    expect(res.valid).toBe(true)
    expect(res.errors.length).toBe(0)
  })
})
