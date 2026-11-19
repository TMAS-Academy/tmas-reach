import { useState } from 'react'
import type { Contact } from '../../types'
import { store } from '../../lib/store'
import { ModalShell } from '../ui/ModalShell'

interface ContactFormModalProps {
  contact?: Contact | null
  onClose: () => void
  onSaved: (message?: string) => void
}

export function ContactFormModal({ contact, onClose, onSaved }: ContactFormModalProps) {
  const [email, setEmail] = useState(contact?.email || '')
  const [firstName, setFirstName] = useState(contact?.first_name || '')
  const [lastName, setLastName] = useState(contact?.last_name || '')
  const [organization, setOrganization] = useState(contact?.organization || '')
  const [district, setDistrict] = useState(contact?.district || '')
  const [jobRole, setJobRole] = useState(contact?.job_role || '')
  const [audienceTag, setAudienceTag] = useState(contact?.audience_tag || 'high_school')
  const [notes, setNotes] = useState(contact?.notes || '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Email address is required.')
      return
    }

    if (contact) {
      const res = store.updateContact(contact.id, {
        email: email.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        organization: organization.trim() || undefined,
        district: district.trim() || undefined,
        job_role: jobRole.trim() || undefined,
        audience_tag: audienceTag.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      if (!res.success) {
        setError(res.error || 'Failed to update contact.')
        return
      }
      onSaved('Contact updated.')
    } else {
      const res = store.addContact({
        email: email.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        organization: organization.trim() || undefined,
        district: district.trim() || undefined,
        job_role: jobRole.trim() || undefined,
        audience_tag: audienceTag.trim() || undefined,
        notes: notes.trim() || undefined,
        status: 'active',
      })
      if (!res.success) {
        setError(res.error || 'Failed to create contact.')
        return
      }
      onSaved('Contact added.')
    }
  }

  const inputClass =
    'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <ModalShell
      onClose={onClose}
      title={contact ? 'Edit Contact' : 'Add Contact'}
      size="md"
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
            type="submit"
            form="contactForm"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            {contact ? 'Save Changes' : 'Create Contact'}
          </button>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <form id="contactForm" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="contact-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            Email Address *
          </label>
          <input
            id="contact-email"
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
              htmlFor="contact-first-name"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              First Name
            </label>
            <input
              id="contact-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Maria"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="contact-last-name"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Last Name
            </label>
            <input
              id="contact-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Vasquez"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contact-org"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Organization / School
            </label>
            <input
              id="contact-org"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Lincoln High School"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="contact-district"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              School District
            </label>
            <input
              id="contact-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Central Unified District"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="contact-role"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Job Role
            </label>
            <input
              id="contact-role"
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="Math Department Chair"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="contact-tag"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
            >
              Audience Tag
            </label>
            <select
              id="contact-tag"
              value={audienceTag}
              onChange={(e) => setAudienceTag(e.target.value)}
              className={inputClass}
            >
              <option value="high_school">High School</option>
              <option value="middle_school">Middle School</option>
              <option value="district_admin">District Admin</option>
              <option value="educators">Educators</option>
              <option value="nonprofit">Nonprofit / Other</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="contact-notes"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
          >
            Notes & Interaction History
          </label>
          <textarea
            id="contact-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Spoke at STEM conference; requested geometry curriculum resources."
            className={inputClass}
          />
        </div>
      </form>
    </ModalShell>
  )
}
