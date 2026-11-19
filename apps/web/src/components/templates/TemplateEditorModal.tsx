import { useMemo, useRef, useState } from 'react'
import type { EmailTemplate } from '../../types'
import { store } from '../../lib/store'
import {
  renderTemplateString,
  analyzeTemplateSpamRisk,
  getDefaultUnsubscribeUrl,
  sanitizePreviewHtml,
} from '../../lib/templateEngine'
import { ModalShell } from '../ui/ModalShell'
import { Eye, Code, HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react'

interface TemplateEditorModalProps {
  template?: EmailTemplate | null
  onClose: () => void
  onSaved: (message: string) => void
}

const SAMPLE_CONTACT = {
  first_name: 'Elena',
  last_name: 'Rodriguez',
  organization: 'Oakridge High School',
  district: 'Central Unified District',
  job_role: 'Math Department Chair',
  audience_tag: 'high_school',
}

const VARIABLES = [
  { tag: '{{first_name}}', desc: 'Educator first name (fallback: "Educator")' },
  { tag: '{{last_name}}', desc: 'Educator last name' },
  { tag: '{{organization}}', desc: 'School or organization (fallback: "your school")' },
  { tag: '{{school}}', desc: 'Alias for school / organization' },
  { tag: '{{district}}', desc: 'School district (fallback: "your district")' },
  { tag: '{{job_role}}', desc: 'Job title or role' },
  { tag: '{{unsubscribe_url}}', desc: 'Required compliance unsubscribe link' },
]

type ActiveField = 'subject' | 'bodyHtml' | 'bodyText'

export function TemplateEditorModal({ template, onClose, onSaved }: TemplateEditorModalProps) {
  const [name, setName] = useState(template?.name || '')
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subject_template || '')
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '')
  const [bodyText, setBodyText] = useState(template?.body_text || '')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
  const [activeField, setActiveField] = useState<ActiveField>('bodyHtml')
  const [error, setError] = useState<string | null>(null)

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyHtmlRef = useRef<HTMLTextAreaElement>(null)
  const bodyTextRef = useRef<HTMLTextAreaElement>(null)

  const handleInsertVariable = (tag: string) => {
    const insertAtCursor = (
      el: HTMLInputElement | HTMLTextAreaElement | null,
      currentValue: string,
      setter: (val: string) => void
    ) => {
      if (!el) {
        setter(`${currentValue}${currentValue ? ' ' : ''}${tag}`)
        return
      }
      const start = el.selectionStart ?? currentValue.length
      const end = el.selectionEnd ?? currentValue.length
      const next = `${currentValue.slice(0, start)}${tag}${currentValue.slice(end)}`
      setter(next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + tag.length
        el.setSelectionRange(pos, pos)
      })
    }

    if (activeField === 'subject') {
      insertAtCursor(subjectRef.current, subjectTemplate, setSubjectTemplate)
    } else if (activeField === 'bodyText') {
      insertAtCursor(bodyTextRef.current, bodyText, setBodyText)
    } else {
      insertAtCursor(bodyHtmlRef.current, bodyHtml, setBodyHtml)
    }
  }

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Template name is required.')
      setMobileTab('edit')
      return
    }
    if (!subjectTemplate.trim()) {
      setError('Subject template is required.')
      setMobileTab('edit')
      return
    }
    if (!bodyHtml.trim() && !bodyText.trim()) {
      setError('Template body is required.')
      setMobileTab('edit')
      return
    }

    if (template) {
      store.updateTemplate(template.id, {
        name: name.trim(),
        subject_template: subjectTemplate.trim(),
        body_html: bodyHtml.trim(),
        body_text: bodyText.trim() || bodyHtml.trim(),
      })
      onSaved('Template saved.')
    } else {
      store.addTemplate({
        name: name.trim(),
        subject_template: subjectTemplate.trim(),
        body_html: bodyHtml.trim(),
        body_text: bodyText.trim() || bodyHtml.trim(),
      })
      onSaved('Template created.')
    }
  }

  const previewSubject = useMemo(
    () => renderTemplateString(subjectTemplate, { contact: SAMPLE_CONTACT }),
    [subjectTemplate]
  )

  const previewHtml = useMemo(
    () =>
      sanitizePreviewHtml(
        renderTemplateString(bodyHtml || bodyText, {
          contact: SAMPLE_CONTACT,
          unsubscribeUrl: getDefaultUnsubscribeUrl('tok-demo-123'),
        })
      ),
    [bodyHtml, bodyText]
  )

  const spamAnalysis = useMemo(
    () => analyzeTemplateSpamRisk(subjectTemplate, bodyHtml || bodyText),
    [subjectTemplate, bodyHtml, bodyText]
  )

  const hasUnsubTag =
    bodyHtml.includes('{{unsubscribe_url}}') || bodyText.includes('{{unsubscribe_url}}')

  const subjectLen = subjectTemplate.trim().length
  const subjectMeterClass =
    subjectLen === 0
      ? 'text-slate-400'
      : subjectLen <= 55
        ? 'text-emerald-600 dark:text-emerald-400'
        : subjectLen <= 70
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400'

  const inputClass =
    'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <ModalShell
      onClose={onClose}
      title={template ? 'Edit Email Template' : 'New Email Template'}
      subtitle="Insert personalization tokens and verify deliverability before campaign approval."
      size="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            {template ? 'Save Changes' : 'Create Template'}
          </button>
        </>
      }
    >
      <div className="mb-4 flex border-b border-slate-200 dark:border-slate-800 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={`flex items-center gap-2 border-b-2 pb-2.5 text-xs font-semibold ${
            mobileTab === 'edit'
              ? 'border-amber-500 text-amber-700 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Code className="h-4 w-4" /> Edit Template
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`ml-6 flex items-center gap-2 border-b-2 pb-2.5 text-xs font-semibold ${
            mobileTab === 'preview'
              ? 'border-amber-500 text-amber-700 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Eye className="h-4 w-4" /> Live Sample Preview
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSave}
          className={`space-y-4 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}
        >
          <div>
            <label
              htmlFor="tpl-name"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Template Name *
            </label>
            <input
              id="tpl-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fall 2026 STEM Workshop Invitation"
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="tpl-subject"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Subject Line Template *
              </label>
              <span className={`font-mono text-[11px] font-semibold ${subjectMeterClass}`}>
                {subjectLen} / 60 chars
              </span>
            </div>
            <input
              ref={subjectRef}
              id="tpl-subject"
              type="text"
              required
              value={subjectTemplate}
              onFocus={() => setActiveField('subject')}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              placeholder="e.g. STEM opportunities for {{organization}}"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          {spamAnalysis.warnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Deliverability Feedback</span>
              </div>
              {spamAnalysis.warnings.map((w, idx) => (
                <div key={idx} className="pl-5 text-amber-900/90 dark:text-amber-300/90">
                  • {w}
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Insert Variable ({activeField === 'subject' ? 'Subject' : activeField === 'bodyText' ? 'Plain Text' : 'HTML Body'})
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <HelpCircle className="h-3 w-3" /> Inserts at cursor
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertVariable(v.tag)}
                  title={v.desc}
                  className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs text-amber-800 hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  {v.tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="tpl-body-html"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Email Body (HTML) *
              </label>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  hasUnsubTag
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {hasUnsubTag ? (
                  <>
                    <CheckCircle className="h-3 w-3" /> Unsubscribe tag present
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Missing {'{{unsubscribe_url}}'}
                  </>
                )}
              </span>
            </div>
            <textarea
              ref={bodyHtmlRef}
              id="tpl-body-html"
              rows={8}
              value={bodyHtml}
              onFocus={() => setActiveField('bodyHtml')}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>Dear {{first_name}},</p>..."
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          <div>
            <label
              htmlFor="tpl-body-text"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Plain Text Alternative (Optional)
            </label>
            <textarea
              ref={bodyTextRef}
              id="tpl-body-text"
              rows={4}
              value={bodyText}
              onFocus={() => setActiveField('bodyText')}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Plain text fallback..."
              className={`${inputClass} font-mono text-xs`}
            />
          </div>
        </form>

        <div
          className={`space-y-4 ${mobileTab === 'edit' ? 'hidden lg:block' : 'block'}`}
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live Sample Preview
            </span>
            <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
              {SAMPLE_CONTACT.first_name} {SAMPLE_CONTACT.last_name} · {SAMPLE_CONTACT.job_role} at{' '}
              {SAMPLE_CONTACT.organization} ({SAMPLE_CONTACT.district})
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-950/40">
            <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Subject
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                {previewSubject || '(Empty Subject)'}
              </div>
            </div>
            <div
              className="prose prose-sm dark:prose-invert mt-4 max-w-none text-slate-800 dark:text-slate-200"
              dangerouslySetInnerHTML={{
                __html: previewHtml || '<p class="text-slate-400">No content yet.</p>',
              }}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
