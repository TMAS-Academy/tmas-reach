import { useState } from 'react'
import { EmailTemplate } from '../../types'
import { store } from '../../lib/store'
import { renderTemplateString } from '../../lib/templateEngine'
import { X, Eye, Code, HelpCircle } from 'lucide-react'

interface TemplateEditorModalProps {
  template?: EmailTemplate | null
  onClose: () => void
  onSaved: () => void
}

const SAMPLE_CONTACT = {
  first_name: 'Maria',
  last_name: 'Vasquez',
  organization: 'Lincoln High School',
  job_role: 'Math Department Chair',
  audience_tag: 'high_school',
}

const VARIABLES = [
  { tag: '{{first_name}}', desc: 'Educator first name (fallback: "Educator")' },
  { tag: '{{last_name}}', desc: 'Educator last name' },
  { tag: '{{organization}}', desc: 'School or district name (fallback: "your school")' },
  { tag: '{{job_role}}', desc: 'Job title or role' },
  { tag: '{{unsubscribe_url}}', desc: 'Required compliance unsubscribe link' },
]

export function TemplateEditorModal({ template, onClose, onSaved }: TemplateEditorModalProps) {
  const [name, setName] = useState(template?.name || '')
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subject_template || '')
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '')
  const [bodyText, setBodyText] = useState(template?.body_text || '')
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [error, setError] = useState<string | null>(null)

  const handleInsertVariable = (tag: string) => {
    setBodyHtml((prev) => `${prev} ${tag} `)
    setBodyText((prev) => `${prev} ${tag} `)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Template name is required.')
      return
    }
    if (!subjectTemplate.trim()) {
      setError('Subject template is required.')
      return
    }
    if (!bodyHtml.trim() && !bodyText.trim()) {
      setError('Template body is required.')
      return
    }

    if (template) {
      store.updateTemplate(template.id, {
        name: name.trim(),
        subject_template: subjectTemplate.trim(),
        body_html: bodyHtml.trim(),
        body_text: bodyText.trim() || bodyHtml.trim(),
      })
    } else {
      store.addTemplate({
        name: name.trim(),
        subject_template: subjectTemplate.trim(),
        body_html: bodyHtml.trim(),
        body_text: bodyText.trim() || bodyHtml.trim(),
      })
    }

    onSaved()
  }

  const previewSubject = renderTemplateString(subjectTemplate, { contact: SAMPLE_CONTACT })
  const previewHtml = renderTemplateString(bodyHtml || bodyText, {
    contact: SAMPLE_CONTACT,
    unsubscribeUrl: 'https://reach.tmasacademy.org/unsubscribe/tok-demo-123',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {template ? 'Edit Email Template' : 'New Email Template'}
            </h3>
            <p className="text-xs text-slate-500">
              Personalized with double-curly braces per Section 2 of Template Personalization Spec
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-6 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 border-b-2 py-2.5 text-xs font-semibold ${
              activeTab === 'edit'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Code className="h-4 w-4" /> Edit Template
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`ml-6 flex items-center gap-2 border-b-2 py-2.5 text-xs font-semibold ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Eye className="h-4 w-4" /> Live Sample Preview
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'edit' ? (
            <form id="templateForm" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fall 2026 STEM Workshop Invitation"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Subject Line Template *
                </label>
                <input
                  type="text"
                  required
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  placeholder="e.g. TMAS STEM opportunities for {{organization}}"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Template Variables (Click to Insert)
                  </label>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <HelpCircle className="h-3 w-3" /> Auto-personalized at send time
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      title={v.desc}
                      className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-indigo-700 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Email Body (HTML / Rich Text) *
                </label>
                <textarea
                  rows={8}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="<p>Dear {{first_name}},</p>..."
                  className="mt-1 block w-full rounded-md border border-slate-300 p-3 font-mono text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Note: Pre-approval check requires the <code className="text-indigo-600 dark:text-indigo-400 font-mono">{"{{unsubscribe_url}}"}</code> tag.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Plain Text Alternative (Optional)
                </label>
                <textarea
                  rows={4}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Plain text fallback..."
                  className="mt-1 block w-full rounded-md border border-slate-300 p-3 font-mono text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sample Recipient
                </span>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {SAMPLE_CONTACT.first_name} {SAMPLE_CONTACT.last_name} ({SAMPLE_CONTACT.job_role} at {SAMPLE_CONTACT.organization})
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Subject:</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-white">
                    {previewSubject || '(Empty Subject)'}
                  </div>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert mt-4 max-w-none text-slate-800 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400">No content</p>' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-6 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="templateForm"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
          >
            {template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
