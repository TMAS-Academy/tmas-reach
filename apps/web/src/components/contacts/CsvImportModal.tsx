import { useState, useMemo } from 'react'
import { Contact } from '../../types'
import { parseCsvContent } from '../../lib/csvParser'
import { store } from '../../lib/store'
import { X, Upload, AlertTriangle, CheckCircle, ShieldAlert, FileText, Download } from 'lucide-react'

interface CsvImportModalProps {
  existingContacts: Contact[]
  onClose: () => void
  onImported: () => void
}

const SAMPLE_CSV = `email,first_name,last_name,organization,job_role,audience_tag
j.smith@springfield.k12.org,John,Smith,Springfield High School,Science Department Chair,high_school
k.patel@metrovalley.edu,Kavita,Patel,Metro Valley District,Curriculum Specialist,district_admin
b.thompson@westlakeacad.org,Brian,Thompson,Westlake Academy,Science Teacher,educators
invalid-email-address,No,Email,Unknown School,Teacher,educators
a.garcia@centralstem.org,Alex,Garcia,Central STEM Academy,Assistant Principal,high_school`

export function CsvImportModal({ existingContacts, onClose, onImported }: CsvImportModalProps) {
  const [csvText, setCsvText] = useState('')
  const [updateEmptyFields, setUpdateEmptyFields] = useState(false)

  const analysis = useMemo(() => {
    if (!csvText.trim()) return null
    return parseCsvContent(csvText, existingContacts, updateEmptyFields)
  }, [csvText, existingContacts, updateEmptyFields])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text || '')
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!analysis || analysis.validRows.length === 0) return
    store.importContacts(analysis.validRows, updateEmptyFields)
    onImported()
  }

  const downloadErrorReport = () => {
    if (!analysis || analysis.invalidRows.length === 0) return
    const content = analysis.invalidRows
      .map((r) => `Row ${r.rowNumber}: ${r.reason} | Raw Line: "${r.rawLine}"`)
      .join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'csv_import_errors.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Import Contacts from CSV
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Validated against Section 1 of CSV & Template Personalization Specification
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Upload className="h-3.5 w-3.5" />
                Upload .CSV File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setCsvText(SAMPLE_CSV)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Load Sample CSV
              </button>
            </div>
            {csvText && (
              <button
                type="button"
                onClick={() => setCsvText('')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              CSV Content (Required header: <code className="text-indigo-600 dark:text-indigo-400 font-mono">email</code>)
            </label>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="email,first_name,last_name,organization,job_role,audience_tag..."
              className="w-full font-mono text-xs rounded-md border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="updateEmpty"
              checked={updateEmptyFields}
              onChange={(e) => setUpdateEmptyFields(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="updateEmpty" className="text-xs text-slate-700 dark:text-slate-300">
              Update empty fields for existing contacts (never overwrites non-active statuses)
            </label>
          </div>

          {analysis && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900">
                  <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle className="h-4 w-4" /> Valid
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-300">
                    {analysis.validRows.length}
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900">
                  <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <FileText className="h-4 w-4" /> Duplicates
                  </div>
                  <div className="mt-1 text-xl font-bold text-amber-800 dark:text-amber-300">
                    {analysis.skippedDuplicates.length}
                  </div>
                </div>

                <div className="rounded-lg bg-purple-50 p-3 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-900">
                  <div className="flex items-center justify-center gap-1 text-purple-700 dark:text-purple-400 text-xs font-semibold">
                    <ShieldAlert className="h-4 w-4" /> Suppressed
                  </div>
                  <div className="mt-1 text-xl font-bold text-purple-800 dark:text-purple-300">
                    {analysis.suppressedExistingEmails.length}
                  </div>
                </div>

                <div className="rounded-lg bg-rose-50 p-3 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900">
                  <div className="flex items-center justify-center gap-1 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Invalid
                  </div>
                  <div className="mt-1 text-xl font-bold text-rose-800 dark:text-rose-300">
                    {analysis.invalidRows.length}
                  </div>
                </div>
              </div>

              {analysis.suppressedExistingEmails.length > 0 && (
                <div className="rounded-md bg-purple-50 p-3 text-xs text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <strong>Suppression Guardrail Active:</strong> {analysis.suppressedExistingEmails.length} recipient(s) are unsubscribed, bounced, or suppressed. Re-activation via CSV import is blocked to maintain compliance.
                </div>
              )}

              {analysis.invalidRows.length > 0 && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  <div className="flex items-center justify-between font-semibold pb-1">
                    <span>Skipped Rows Error Report ({analysis.invalidRows.length})</span>
                    <button
                      type="button"
                      onClick={downloadErrorReport}
                      className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] text-rose-700 shadow-sm border border-rose-300 dark:bg-slate-800 dark:text-rose-300 dark:border-rose-800"
                    >
                      <Download className="h-3 w-3" /> Download Report
                    </button>
                  </div>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {analysis.invalidRows.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        Row {err.rowNumber}: {err.reason}
                      </li>
                    ))}
                    {analysis.invalidRows.length > 5 && (
                      <li>...and {analysis.invalidRows.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {analysis.validRows.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                    Preview of Contacts to Import ({analysis.validRows.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                        <tr>
                          <th className="p-2">Email</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Organization</th>
                          <th className="p-2">Tag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {analysis.validRows.map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono">{row.email}</td>
                            <td className="p-2">{row.first_name || ''} {row.last_name || ''}</td>
                            <td className="p-2">{row.organization || '—'}</td>
                            <td className="p-2">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                                {row.audience_tag || 'none'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
            type="button"
            disabled={!analysis || analysis.validRows.length === 0}
            onClick={handleImport}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Import {analysis?.validRows.length ? `${analysis.validRows.length} Contacts` : 'Contacts'}
          </button>
        </div>
      </div>
    </div>
  )
}
