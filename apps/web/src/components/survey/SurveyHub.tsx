import { useState, useMemo } from 'react'
import type { SurveySubmission } from '../../types/survey'
import { surveySubmissionsToCsv, getBlankCsvTemplate } from '../../lib/surveyEngine'
import { store } from '../../lib/store'
import { EducatorSurveyForm } from './EducatorSurveyForm'
import type { ToastType } from '../ui/Toast'
import {
  Download,
  Plus,
  CheckCircle,
  FileSpreadsheet,
  Clock,
  Archive,
  Filter,
  UserCheck,
  School,
  Search,
  X,
} from 'lucide-react'

interface SurveyHubProps {
  surveys: SurveySubmission[]
  onToast?: (type: ToastType, text: string) => void
}

export function SurveyHub({ surveys, onToast }: SurveyHubProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSurveyFormOpen, setIsSurveyFormOpen] = useState(false)

  const filteredSurveys = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return surveys.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!q) return true
      return (
        s.email.toLowerCase().includes(q) ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.organization.toLowerCase().includes(q) ||
        (s.district || '').toLowerCase().includes(q) ||
        s.job_role.toLowerCase().includes(q)
      )
    })
  }, [surveys, statusFilter, searchTerm])

  const stats = useMemo(() => {
    const total = surveys.length
    const pending = surveys.filter((s) => s.status === 'pending_review').length
    const imported = surveys.filter((s) => s.status === 'imported_to_contacts').length
    const totalStudents = surveys.reduce((acc, s) => acc + (s.estimated_students || 0), 0)
    return { total, pending, imported, totalStudents }
  }, [surveys])

  const hasActiveFilters = statusFilter !== 'all' || searchTerm.trim() !== ''

  const handleExportResponsesCsv = () => {
    if (surveys.length === 0) {
      onToast?.('info', 'No survey submissions to export.')
      return
    }

    const csvData = surveySubmissionsToCsv(surveys)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmas_survey_responses_intake.csv'
    a.click()
    URL.revokeObjectURL(url)

    onToast?.('success', `Exported ${surveys.length} survey responses to CSV.`)
  }

  const handleDownloadBlankTemplate = () => {
    const templateData = getBlankCsvTemplate()
    const blob = new Blob([templateData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmas_reach_outreach_template.csv'
    a.click()
    URL.revokeObjectURL(url)

    onToast?.('info', 'Downloaded blank outreach CSV template.')
  }

  const handlePromote = (submissionId: string) => {
    const res = store.promoteSurveyToContact(submissionId)
    if (res.success) {
      onToast?.('success', 'Promoted survey response to active outreach contact.')
    } else {
      onToast?.('error', res.error || 'Failed to promote survey response.')
    }
  }

  const handleArchive = (submissionId: string) => {
    store.archiveSurvey(submissionId)
    onToast?.('info', 'Archived survey submission.')
  }

  if (isSurveyFormOpen) {
    return (
      <EducatorSurveyForm
        onCancel={() => setIsSurveyFormOpen(false)}
        onSuccess={() => setIsSurveyFormOpen(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <School className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Educator Outreach Intake
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Review incoming educator surveys and promote verified contacts into outreach lists.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadBlankTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            title="Download formatted CSV spreadsheet template"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Blank CSV Template
          </button>

          <button
            type="button"
            onClick={handleExportResponsesCsv}
            disabled={surveys.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            title="Export all collected survey responses to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setIsSurveyFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Submit New Survey
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Total Submissions
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Pending Review
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.pending}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Promoted to Contacts
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.imported}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Est. Student Reach
          </span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalStudents}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search educator, email, school, district..."
            aria-label="Search survey submissions"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <label htmlFor="survey-status-filter" className="text-xs text-slate-600 dark:text-slate-400">
            Status:
          </label>
          <select
            id="survey-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Submissions ({surveys.length})</option>
            <option value="pending_review">Pending Review</option>
            <option value="imported_to_contacts">Imported to Contacts</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('all')
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Educator & Email</th>
                <th className="px-4 py-3">School / District</th>
                <th className="px-4 py-3">Role & Audience</th>
                <th className="px-4 py-3">Programs of Interest</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSurveys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      {surveys.length === 0
                        ? 'No survey responses collected yet.'
                        : 'No survey responses match your current filters.'}
                    </p>
                    {surveys.length === 0 && (
                      <>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Submit a survey response or download the blank template to collate school
                          information offline.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSurveyFormOpen(true)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 shadow-2xs"
                        >
                          <Plus className="h-3.5 w-3.5" /> Fill Intake Survey
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSurveys.map((survey) => (
                  <tr key={survey.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {survey.first_name} {survey.last_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {survey.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {survey.organization}
                      </div>
                      {survey.district && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {survey.district}
                        </div>
                      )}
                      {survey.estimated_students && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          ~{survey.estimated_students} students
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800 dark:text-slate-200">{survey.job_role}</div>
                      <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {survey.audience_tag}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-[11px] text-slate-600 dark:text-slate-400">
                        {survey.programs_of_interest?.join(', ') || 'General Outreach'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {survey.status === 'pending_review' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          <Clock className="h-3 w-3" /> Pending Review
                        </span>
                      )}
                      {survey.status === 'imported_to_contacts' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" /> In Contacts
                        </span>
                      )}
                      {survey.status === 'archived' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <Archive className="h-3 w-3" /> Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {survey.status === 'pending_review' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePromote(survey.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                              title="Add this educator to outreach contacts list"
                            >
                              <UserCheck className="h-3 w-3" /> Add to Contacts
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(survey.id)}
                              aria-label={`Archive submission from ${survey.email}`}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                              title="Archive submission"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {survey.status === 'imported_to_contacts' && (
                          <button
                            type="button"
                            onClick={() => handleArchive(survey.id)}
                            aria-label={`Archive submission from ${survey.email}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            title="Archive submission"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
