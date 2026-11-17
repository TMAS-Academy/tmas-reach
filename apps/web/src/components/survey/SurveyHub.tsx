import { useState, useMemo } from 'react'
import type { SurveySubmission } from '../../types/survey'
import { surveySubmissionsToCsv, getBlankCsvTemplate } from '../../lib/surveyEngine'
import { store } from '../../lib/store'
import { EducatorSurveyForm } from './EducatorSurveyForm'
import {
  Download,
  Plus,
  CheckCircle,
  FileSpreadsheet,
  Clock,
  Archive,
  Filter,
  UserCheck,
} from 'lucide-react'

interface SurveyHubProps {
  surveys: SurveySubmission[]
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void
}

export function SurveyHub({ surveys, onToast }: SurveyHubProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isSurveyFormOpen, setIsSurveyFormOpen] = useState(false)

  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (statusFilter === 'all') return true
      return s.status === statusFilter
    })
  }, [surveys, statusFilter])

  const stats = useMemo(() => {
    const total = surveys.length
    const pending = surveys.filter((s) => s.status === 'pending_review').length
    const imported = surveys.filter((s) => s.status === 'imported_to_contacts').length
    const totalStudents = surveys.reduce((acc, s) => acc + (s.estimated_students || 0), 0)
    return { total, pending, imported, totalStudents }
  }, [surveys])

  const handleExportResponsesCsv = () => {
    if (surveys.length === 0) {
      if (onToast) onToast('info', 'No survey submissions to export.')
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

    if (onToast) onToast('success', `Exported ${surveys.length} survey responses to CSV.`)
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

    if (onToast) onToast('info', 'Downloaded blank outreach CSV template.')
  }

  const handlePromote = (submissionId: string) => {
    const res = store.promoteSurveyToContact(submissionId)
    if (res.success) {
      if (onToast) onToast('success', 'Promoted survey response to active outreach contact.')
    } else {
      if (onToast) onToast('error', res.error || 'Failed to promote survey response.')
    }
  }

  const handleArchive = (submissionId: string) => {
    store.archiveSurvey(submissionId)
    if (onToast) onToast('info', 'Archived survey submission.')
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
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Educator Outreach Intake Hub
          </h2>
          <p className="text-xs text-slate-500">
            Collect, verify, and export real school and educator survey data into CSV format for campaign outreach
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadBlankTemplate}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-xs"
            title="Download formatted CSV spreadsheet template"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Download Blank CSV Template
          </button>

          <button
            type="button"
            onClick={handleExportResponsesCsv}
            disabled={surveys.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-xs disabled:opacity-50"
            title="Export all collected survey responses to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export Responses to CSV
          </button>

          <button
            type="button"
            onClick={() => setIsSurveyFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Submit New Survey
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-500">Total Submissions</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Review</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Promoted to Contacts</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.imported}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Est. Student Reach</span>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.totalStudents}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 py-1 pl-2 pr-7 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Submissions ({surveys.length})</option>
            <option value="pending_review">Pending Review</option>
            <option value="imported_to_contacts">Imported to Contacts</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Educator & Email</th>
              <th className="px-4 py-3">School / Organization</th>
              <th className="px-4 py-3">Role & Audience</th>
              <th className="px-4 py-3">Programs of Interest</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSurveys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
                    <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-600 dark:text-slate-300">No survey responses collected yet.</p>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Submit a test survey response or download the blank template to collate school information offline.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSurveyFormOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
                  >
                    <Plus className="h-3 w-3" /> Fill Intake Survey
                  </button>
                </td>
              </tr>
            ) : (
              filteredSurveys.map((survey) => (
                <tr key={survey.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {survey.first_name} {survey.last_name}
                    </div>
                    <div className="font-mono text-slate-500 text-[11px]">{survey.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{survey.organization}</div>
                    {survey.estimated_students && (
                      <div className="text-[10px] text-slate-400">~{survey.estimated_students} students</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{survey.job_role}</div>
                    <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {survey.audience_tag}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {survey.programs_of_interest.join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {survey.status === 'pending_review' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
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
                      {survey.status === 'pending_review' ? (
                        <button
                          type="button"
                          onClick={() => handlePromote(survey.id)}
                          className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800"
                          title="Add this educator to outreach contacts list"
                        >
                          <UserCheck className="h-3 w-3" /> Add to Contacts
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchive(survey.id)}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Archive survey"
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
  )
}
