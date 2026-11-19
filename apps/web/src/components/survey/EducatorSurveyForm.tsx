import { useState } from 'react'
import type { SurveyAudienceOption, SurveyRoleOption } from '../../types/survey'
import { validateSurveySubmission } from '../../lib/surveyEngine'
import { store } from '../../lib/store'
import { CheckCircle, AlertCircle, Send, School, ArrowLeft } from 'lucide-react'

interface EducatorSurveyFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  embedded?: boolean
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

export function EducatorSurveyForm({
  onSuccess,
  onCancel,
  embedded = false,
}: EducatorSurveyFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [organization, setOrganization] = useState('')
  const [district, setDistrict] = useState('')
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
  const [submittedOrg, setSubmittedOrg] = useState('')

  const handleProgramToggle = (prog: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(prog) ? prev.filter((p) => p !== prog) : [...prev, prog]
    )
  }

  const resetFormFields = () => {
    setIsSubmitted(false)
    setEmail('')
    setFirstName('')
    setLastName('')
    setOrganization('')
    setDistrict('')
    setNotes('')
    setErrors([])
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
      district: district.trim() || undefined,
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
    setSubmittedOrg(organization.trim())
    setIsSubmitted(true)
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  if (isSubmitted) {
    return (
      <div
        className={
          embedded
            ? 'py-6 text-center'
            : 'mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900'
        }
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60">
          <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Information Received
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Thank you for submitting outreach details for <strong>{submittedOrg}</strong>. The
          response is now in the intake queue ready for review or promotion to contacts.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={resetFormFields}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            Submit Another Response
          </button>
          {(onSuccess || onCancel) && (
            <button
              type="button"
              onClick={() => (onSuccess ? onSuccess() : onCancel?.())}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              Done
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        embedded
          ? ''
          : 'mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900'
      }
    >
      {!embedded && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      {!embedded && (
        <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/15 p-2 text-amber-700 dark:text-amber-400">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Educator & School Outreach Survey
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Collect educator contact information and school details for TMAS Academy outreach.
              </p>
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-4 space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4" /> Please fix the following errors:
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${embedded ? '' : 'mt-6'} space-y-5 text-xs`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="survey-first-name"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              First Name *
            </label>
            <input
              id="survey-first-name"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Maria"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="survey-last-name"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Last Name *
            </label>
            <input
              id="survey-last-name"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Rodriguez"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="survey-email"
            className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            School / Institutional Email *
          </label>
          <input
            id="survey-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. educator@school.edu"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="survey-org"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              School or Organization *
            </label>
            <input
              id="survey-org"
              type="text"
              required
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Oakridge High School"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="survey-district"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              School District (Optional)
            </label>
            <input
              id="survey-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Central Unified District"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="survey-audience"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Audience Category *
            </label>
            <select
              id="survey-audience"
              value={audienceTag}
              onChange={(e) => setAudienceTag(e.target.value as SurveyAudienceOption)}
              className={inputClass}
            >
              <option value="high_school">High School (Grades 9-12)</option>
              <option value="middle_school">Middle School (Grades 6-8)</option>
              <option value="district_admin">School District Administrator</option>
              <option value="educators">General STEM Educator</option>
              <option value="nonprofit">Educational Non-Profit</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="survey-role"
              className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Your Role or Title *
            </label>
            <select
              id="survey-role"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value as SurveyRoleOption)}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {jobRole === 'Other' && (
          <input
            type="text"
            required
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder="Please specify your role..."
            className={inputClass}
          />
        )}

        <div>
          <span className="mb-2 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            TMAS Academy Programs of Interest
          </span>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/30">
            {PROGRAMS.map((prog) => (
              <label key={prog} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedPrograms.includes(prog)}
                  onChange={() => handleProgramToggle(prog)}
                  className="h-4 w-4 rounded border-slate-300 accent-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                />
                <span className="text-slate-700 dark:text-slate-300">{prog}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="survey-students"
            className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            Estimated Student Enrollment Reached
          </label>
          <input
            id="survey-students"
            type="number"
            min={1}
            max={10000}
            value={estimatedStudents}
            onChange={(e) => setEstimatedStudents(parseInt(e.target.value, 10) || 0)}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="survey-notes"
            className="mb-1 block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            Additional Questions or Curriculum Notes
          </label>
          <textarea
            id="survey-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Share any specific math topics or timing preferences..."
            className={inputClass}
          />
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              required
              checked={consentOutreach}
              onChange={(e) => setConsentOutreach(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400/70"
            />
            <span className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              I consent to receive organizational outreach, workshop notices, and competition
              updates from <strong>TMAS Academy</strong>. I can unsubscribe at any time via the
              link in any message.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-5 py-2.5 font-semibold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            <Send className="h-3.5 w-3.5" /> Submit Survey
          </button>
        </div>
      </form>
    </div>
  )
}
