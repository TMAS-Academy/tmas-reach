import { useState, useMemo } from 'react'
import type { Contact } from '../../types'
import { parseCsvContent } from '../../lib/csvParser'
import { store } from '../../lib/store'
import { ModalShell } from '../ui/ModalShell'
import { Upload, AlertTriangle, CheckCircle, ShieldAlert, FileText, Download } from 'lucide-react'

interface CsvImportModalProps {
  existingContacts: Contact[]
  onClose: () => void
  onImported: (count: number) => void
}

const SAMPLE_CSV = `email,first_name,last_name,organization,district,job_role,audience_tag
math.lead@school.edu,Elena,Rodriguez,Regional High School,County School District,Math Department Chair,high_school
director@stemdistrict.k12.org,David,Chen,,Metro ISD,STEM Coordinator,district_admin
faculty@academy.org,Priya,Patel,Community Prep Academy,East District,Science Educator,educators`

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
    const count = store.importContacts(analysis.validRows, updateEmptyFields)
    onImported(count)
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
    <ModalShell
      onClose={onClose}
      title="Import Contacts from CSV"
      subtitle="Validates emails, detects duplicates, and protects suppressed contacts."
      size="lg"
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
            disabled={!analysis || analysis.validRows.length === 0}
            onClick={handleImport}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            Import {analysis?.validRows.length ? `${analysis.validRows.length} Contacts` : 'Contacts'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              Load Sample CSV
            </button>
          </div>
          {csvText && (
            <button
              type="button"
              onClick={() => setCsvText('')}
              className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        <div>
          <label
            htmlFor="csv-textarea"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            CSV Content (Required header:{' '}
            <code className="font-mono text-amber-700 dark:text-amber-400">email</code>)
          </label>
          <textarea
            id="csv-textarea"
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="email,first_name,last_name,organization,district,job_role,audience_tag..."
            className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <label htmlFor="updateEmpty" className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            id="updateEmpty"
            checked={updateEmptyFields}
            onChange={(e) => setUpdateEmptyFields(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400/70"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300">
            Update empty fields for existing active contacts (never overwrites non-active statuses)
          </span>
        </label>

        {analysis && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" /> Valid
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-300">
                  {analysis.validRows.length}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
                  <FileText className="h-4 w-4" /> Duplicates
                </div>
                <div className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-300">
                  {analysis.skippedDuplicates.length}
                </div>
              </div>

              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/40">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-400">
                  <ShieldAlert className="h-4 w-4" /> Suppressed
                </div>
                <div className="mt-1 text-xl font-bold text-purple-800 dark:text-purple-300">
                  {analysis.suppressedExistingEmails.length}
                </div>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" /> Invalid
                </div>
                <div className="mt-1 text-xl font-bold text-rose-800 dark:text-rose-300">
                  {analysis.invalidRows.length}
                </div>
              </div>
            </div>

            {analysis.updatedContacts && analysis.updatedContacts.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                <strong>Existing Contacts to Update:</strong> {analysis.updatedContacts.length}{' '}
                existing active contact(s) have new details in this CSV and will be updated.
              </div>
            )}

            {analysis.suppressedExistingEmails.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
                <strong>Suppression Guardrail Active:</strong>{' '}
                {analysis.suppressedExistingEmails.length} recipient(s) are unsubscribed, bounced,
                or suppressed. Re-activation via CSV import is blocked.
              </div>
            )}

            {analysis.invalidRows.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <div className="flex items-center justify-between pb-1 font-semibold">
                  <span>Skipped Rows Error Report ({analysis.invalidRows.length})</span>
                  <button
                    type="button"
                    onClick={downloadErrorReport}
                    className="flex items-center gap-1 rounded border border-rose-300 bg-white px-2 py-0.5 text-[11px] text-rose-700 shadow-2xs dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300"
                  >
                    <Download className="h-3 w-3" /> Download Report
                  </button>
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
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
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                  Preview of Contacts to Import ({analysis.validRows.length})
                </h4>
                <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <tr>
                        <th className="p-2">Email</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">School</th>
                        <th className="p-2">District</th>
                        <th className="p-2">Tag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analysis.validRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono">{row.email}</td>
                          <td className="p-2">
                            {row.first_name || ''} {row.last_name || ''}
                          </td>
                          <td className="p-2">{row.organization || '—'}</td>
                          <td className="p-2">{row.district || '—'}</td>
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
    </ModalShell>
  )
}
