import { useState } from 'react'
import type { EmailTemplate } from '../../types'
import { TemplateEditorModal } from './TemplateEditorModal'
import { store } from '../../lib/store'
import { Plus, Edit2, FileText, CheckCircle, AlertTriangle, Copy } from 'lucide-react'

interface TemplateListProps {
  templates: EmailTemplate[]
}

export function TemplateList({ templates }: TemplateListProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400 border border-amber-400/30 shadow-xs shadow-amber-400/10 animate-subtle-float">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Email Templates
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingTemplate(null)
            setIsEditorOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 shadow-sm shadow-amber-400/20 transition-all hover:scale-103 active:scale-97 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((tpl) => {
          const hasUnsub =
            (tpl.body_html || '').includes('{{unsubscribe_url}}') ||
            (tpl.body_text || '').includes('{{unsubscribe_url}}')

          return (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{tpl.name}</h4>
                      <span className="text-[11px] text-slate-400">
                        Updated {new Date(tpl.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => store.duplicateTemplate(tpl.id)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
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
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit Template"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-md bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Subject Line
                  </span>
                  <p className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {tpl.subject_template}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {hasUnsub ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> Unsubscribe Tag Present
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Missing {`{{unsubscribe_url}}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(tpl)
                    setIsEditorOpen(true)
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  Inspect & Edit &rarr;
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {isEditorOpen && (
        <TemplateEditorModal
          template={editingTemplate}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  )
}
