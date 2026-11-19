import { useMemo, useState } from 'react'
import type { EmailTemplate } from '../../types'
import { TemplateEditorModal } from './TemplateEditorModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { ToastType } from '../ui/Toast'
import { store } from '../../lib/store'
import {
  Plus,
  Edit2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Copy,
  Trash2,
  Search,
} from 'lucide-react'

interface TemplateListProps {
  templates: EmailTemplate[]
  onToast?: (type: ToastType, text: string) => void
}

export function TemplateList({ templates, onToast }: TemplateListProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null)

  const filteredTemplates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.subject_template.toLowerCase().includes(q)
    )
  }, [templates, searchTerm])

  const handleDuplicate = (tpl: EmailTemplate) => {
    const res = store.duplicateTemplate(tpl.id)
    if (res.success) {
      onToast?.('success', `Duplicated "${tpl.name}".`)
    } else {
      onToast?.('error', res.error || 'Failed to duplicate template.')
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const res = store.deleteTemplate(deleteTarget.id)
    if (res.success) {
      onToast?.('info', `Deleted template "${deleteTarget.name}".`)
    } else {
      onToast?.('error', res.error || 'Unable to delete template.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Email Templates
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Reusable outreach messages with personalization tokens and compliance checks.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null)
              setIsEditorOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {templates.length === 0
              ? 'Create your first email template with personalization tags and an unsubscribe link.'
              : `No templates matched "${searchTerm}".`}
          </p>
          {templates.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null)
                setIsEditorOpen(true)
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              <Plus className="h-4 w-4" /> Create Template
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-3 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredTemplates.map((tpl) => {
            const hasUnsub =
              (tpl.body_html || '').includes('{{unsubscribe_url}}') ||
              (tpl.body_text || '').includes('{{unsubscribe_url}}')

            return (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-amber-700 dark:text-amber-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-slate-900 dark:text-white">
                          {tpl.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Updated {new Date(tpl.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(tpl)}
                        aria-label={`Duplicate ${tpl.name}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Duplicate Template"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplate(tpl)
                          setIsEditorOpen(true)
                        }}
                        aria-label={`Edit ${tpl.name}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Edit Template"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tpl)}
                        aria-label={`Delete ${tpl.name}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Delete Template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Subject Line
                    </span>
                    <p className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                      {tpl.subject_template}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {hasUnsub ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Unsubscribe Tag Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> Missing {`{{unsubscribe_url}}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(tpl)
                      setIsEditorOpen(true)
                    }}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    Inspect & Edit &rarr;
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isEditorOpen && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => setIsEditorOpen(false)}
          onSaved={(msg) => {
            setIsEditorOpen(false)
            onToast?.('success', msg)
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete template?"
        message={`Delete "${deleteTarget?.name || ''}"? Templates referenced by pending or active campaigns cannot be deleted.`}
        confirmLabel="Delete template"
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
