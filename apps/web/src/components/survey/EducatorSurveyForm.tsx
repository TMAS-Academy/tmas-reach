import { useState } from 'react'
import type { SurveyAudienceOption, SurveyRoleOption } from '../../types/survey'
import { validateSurveySubmission } from '../../lib/surveyEngine'
import { store } from '../../lib/store'
import { CheckCircle, AlertCircle, Send, School, ArrowLeft } from 'lucide-react'

interface EducatorSurveyFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

const ROLES: SurveyRoleOption[] = [
  'Principal',
  'Assistant Principal',
  'Math Department Chair',
  'STEM Curriculum Director',
  'High School Math Teacher',
  'Middle School Math Teacher',
  'District Administrator',
  'Academic Dean',
  'Other',
]

const PROGRAMS = [
  'Competitive Mathematics (AMC 8 / 10 / 12)',
  'Extracurricular STEM Enrichment Clinics',
  'Complimentary Teacher Workshop Kits',
  'School-wide Math Challenge Pathways',
  'District-wide Academic Olympiad Coaching',
]

export function EducatorSurveyForm({ onSuccess, onCancel }: EducatorSurveyFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [organization, setOrganization] = useState('')
  const [jobRole, setJobRole] = useState<SurveyRoleOption>('Math Department Chair')
  const [customRole, setCustomRole] = useState('')
  const [audienceTag, setAudienceTag] = useState<SurveyAudienceOption>('high_school')
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([
    'Competitive Mathematics (AMC 8 / 10 / 12)',
  ])
  const [estimatedStudents, setEstimatedStudents] = useState<number>(50)
  const [notes, setNotes] = useState('')
  const [consentOutreach, setConsentOutreach] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleProgramToggle = (prog: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(prog) ? prev.filter((p) => p !== prog) : [...prev, prog]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const resolvedRole = jobRole === 'Other' && customRole.trim() ? customRole.trim() : jobRole

    const submissionData = {
      email,
      first_name: firstName,
      last_name: lastName,
      organization,
      job_role: resolvedRole,
      audience_tag: audienceTag,
      grade_levels: [audienceTag === 'middle_school' ? 'Grades 6-8' : 'Grades 9-12'],
      programs_of_interest: selectedPrograms,
      estimated_students: estimatedStudents,
      notes: notes.trim() || undefined,
      consent_outreach: consentOutreach,
    }

    const validation = validateSurveySubmission(submissionData)
    if (!validation.valid) {
      setErrors(validation.errors.map((err) => err.message))
      return
    }

    store.addSurveySubmission(submissionData)
    setIsSubmitted(true)
    if (onSuccess) onSuccess()
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Information Received!
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Thank you for providing your school outreach details for <strong>{organization}</strong>.
          Your response has been saved to the intake hub and can now be exported to CSV or promoted to outreach contacts.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false)
              setEmail('')
              setFirstName('')
              setLastName('')
              setOrganization('')
              setNotes('')
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
          >
            Submit Another Response
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <School className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Educator & School Outreach Survey
            </h2>
            <p className="text-xs text-slate-500">
              Collect verified educator names and school details for TMAS Academy outreach programs.
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4" /> Please fix the following errors:
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5 text-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Maria"
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Rodriguez"
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            School / Institutional Email *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. educator@school.edu"
            className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              School or School District Name *
            </label>
            <input
              type="text"
              required
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Oakridge High School"
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Audience Category *
            </label>
            <select
              value={audienceTag}
              onChange={(e) => setAudienceTag(e.target.value as SurveyAudienceOption)}
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="high_school">High School (Grades 9-12)</option>
              <option value="middle_school">Middle School (Grades 6-8)</option>
              <option value="district_admin">School District Administrator</option>
              <option value="educators">General STEM Educator</option>
              <option value="nonprofit">Educational Non-Profit</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Your Role or Title *
          </label>
          <select
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value as SurveyRoleOption)}
            className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {jobRole === 'Other' && (
            <input
              type="text"
              required
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="Please specify your role..."
              className="mt-2 w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          )}
        </div>

        <div>
          <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            TMAS Academy Programs of Interest
          </label>
          <div className="space-y-2 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            {PROGRAMS.map((prog) => (
              <label key={prog} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPrograms.includes(prog)}
                  onChange={() => handleProgramToggle(prog)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{prog}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Estimated Student Enrollment Reached
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={estimatedStudents}
            onChange={(e) => setEstimatedStudents(parseInt(e.target.value) || 0)}
            className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Additional Questions or Curriculum Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Share any specific math topics or timing preferences..."
            className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-950 dark:bg-indigo-950/40">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={consentOutreach}
              onChange={(e) => setConsentOutreach(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              I consent to receive organizational outreach, workshop notices, and competition updates from <strong>TMAS Academy</strong>. I understand I can unsubscribe at any time via the compliance link in any message.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" /> Submit Survey Information
          </button>
        </div>
      </form>
    </div>
  )
}
