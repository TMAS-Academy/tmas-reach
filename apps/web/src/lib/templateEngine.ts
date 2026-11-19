import type { Contact, EmailTemplate } from '../types'

export interface RenderContext {
  contact?: Partial<Contact>
  unsubscribeUrl?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface SpamRiskAnalysis {
  hasWarnings: boolean
  warnings: string[]
  subjectLength: number
  bodyLength: number
}

const COMMON_SPAM_WORDS = [
  '100% free',
  'act now',
  'apply now',
  'guaranteed',
  'make money',
  'no catch',
  'no cost',
  'risk-free',
  'urgent',
  'winner',
  'congratulations',
  '$$$',
]

export function analyzeTemplateSpamRisk(
  subject: string,
  body: string
): SpamRiskAnalysis {
  const warnings: string[] = []
  const sub = subject.trim()
  const full = `${subject} ${body}`.toLowerCase()

  if (sub.length > 70) {
    warnings.push(`Subject line is ${sub.length} characters long. Over 60-70 characters may get truncated on mobile screens.`)
  }

  const uppercaseWords = sub
    .split(/\s+/)
    .filter((w) => w.length > 2 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))
  if (uppercaseWords.length >= 3) {
    warnings.push('Subject contains multiple consecutive uppercase words which can trigger spam filters.')
  }

  COMMON_SPAM_WORDS.forEach((phrase) => {
    if (full.includes(phrase)) {
      warnings.push(`Contains spam-trigger phrase: "${phrase}".`)
    }
  })

  if (/[!]{2,}/.test(subject) || /[?]{2,}/.test(subject)) {
    warnings.push('Subject contains repeated punctuation (e.g. "!!" or "??").')
  }

  return {
    hasWarnings: warnings.length > 0,
    warnings,
    subjectLength: sub.length,
    bodyLength: body.length,
  }
}

const KNOWN_VARIABLES = [
  'first_name',
  'last_name',
  'organization',
  'school',
  'district',
  'job_role',
  'unsubscribe_url',
]

export function getDefaultUnsubscribeUrl(token = 'sample-token'): string {
  const configuredBase = (import.meta.env?.VITE_APP_PUBLIC_URL as string | undefined)?.trim()
  const safeToken = encodeURIComponent(token)
  if (configuredBase) {
    return `${configuredBase.replace(/\/+$/, '')}/unsubscribe/${safeToken}`
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
  ) {
    return `${window.location.origin}/?tab=unsubscribe&token=${safeToken}`
  }
  return `https://example.org/unsubscribe/${safeToken}`
}

const FORBIDDEN_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'meta',
  'link',
  'base',
  'svg',
  'math',
  'template',
  'noscript',
])

const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])

function isUnsafeUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  const normalized = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase()
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html')
  )
}

export function sanitizePreviewHtml(html: string): string {
  if (!html) return ''

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const elements = Array.from(doc.body.querySelectorAll('*'))
    for (const el of elements) {
      if (FORBIDDEN_TAGS.has(el.tagName.toLowerCase())) {
        el.remove()
        continue
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on') || name === 'srcdoc') {
          el.removeAttribute(attr.name)
          continue
        }
        if (URL_ATTRS.has(name) && isUnsafeUrl(attr.value)) {
          el.setAttribute(attr.name, '#')
          continue
        }
        if (name === 'style' && /expression\s*\(|javascript\s*:/i.test(attr.value)) {
          el.removeAttribute(attr.name)
        }
      }
    }
    return doc.body.innerHTML
  }

  return html
    .replace(/<(script|iframe|object|embed|svg|math|form)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action)\s*=\s*(['"])\s*(javascript:|vbscript:|data:text\/html)[^'"]*\2/gi, '$1="#"')
}

export function renderTemplateString(
  template: string,
  context: RenderContext = {}
): string {
  const { contact = {}, unsubscribeUrl = getDefaultUnsubscribeUrl() } = context

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    switch (key) {
      case 'first_name':
        return contact.first_name?.trim() || 'Educator'
      case 'last_name':
        return contact.last_name?.trim() || ''
      case 'organization':
      case 'school':
        return contact.organization?.trim() || 'your school'
      case 'district':
        return contact.district?.trim() || 'your district'
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
