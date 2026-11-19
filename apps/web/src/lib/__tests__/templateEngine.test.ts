import { describe, it, expect } from 'vitest'
import {
  renderTemplateString,
  validateCampaignPreApproval,
  analyzeTemplateSpamRisk,
  sanitizePreviewHtml,
  getDefaultUnsubscribeUrl,
} from '../templateEngine'
import { store } from '../store'
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
    const raw = 'Hello {{first_name}}, partner with us at {{organization}} in {{district}}.'
    const rendered = renderTemplateString(raw, { contact: {} })
    expect(rendered).toBe('Hello Educator, partner with us at your school in your district.')
  })

  it('interpolates district and school alias variables', () => {
    const raw = 'Programs for {{school}} in {{district}}.'
    const rendered = renderTemplateString(raw, {
      contact: {
        organization: 'Metro High',
        district: 'Central Unified',
      },
    })
    expect(rendered).toBe('Programs for Metro High in Central Unified.')
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

  it('duplicates existing template with (Copy) suffix', () => {
    store.resetToDefault()

    const original = store.getTemplates()[0]
    const res = store.duplicateTemplate(original.id)
    expect(res.success).toBe(true)
    expect(res.template?.name).toBe(`${original.name} (Copy)`)
    expect(res.template?.subject_template).toBe(original.subject_template)
    expect(res.template?.body_html).toBe(original.body_html)
  })

  it('uses an origin-based or neutral fallback unsubscribe URL without hardcoded academy domain', () => {
    const url = getDefaultUnsubscribeUrl('tok-999')
    expect(url).toContain('tok-999')
    expect(url).not.toContain('tmasacademy.org')
  })

  it('sanitizes dangerous tags, event handlers, and javascript URLs from preview HTML', () => {
    const dirty =
      '<p onclick="alert(1)">Hello <a href="javascript:alert(2)">click</a></p><script>evil()</script><iframe src="https://bad.test"></iframe>'
    const clean = sanitizePreviewHtml(dirty)
    expect(clean).toContain('<p>Hello ')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
  })

  it('reports no spam warnings for clean educator outreach copy', () => {
    const res = analyzeTemplateSpamRisk(
      'Spring STEM workshop invitation for {{organization}}',
      '<p>Hello {{first_name}}, we would love to partner with your department.</p>'
    )
    expect(res.hasWarnings).toBe(false)
    expect(res.warnings).toHaveLength(0)
    expect(res.subjectLength).toBe(52)
  })

  it('flags long subjects, excessive uppercase words, spam phrases, and repeated punctuation', () => {
    const longSubject =
      'URGENT FREE INVITATION ACT NOW FOR ALL EDUCATORS ACROSS THE ENTIRE DISTRICT!!'
    const res = analyzeTemplateSpamRisk(
      longSubject,
      'This offer is 100% free and risk-free with no catch.'
    )
    expect(res.hasWarnings).toBe(true)
    expect(res.warnings.some((w) => w.includes('characters long'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('uppercase words'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('repeated punctuation'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('"100% free"'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('"act now"'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('"risk-free"'))).toBe(true)
    expect(res.warnings.some((w) => w.includes('"no catch"'))).toBe(true)
  })
})
