import { useState } from 'react'
import { Contact } from '../../types'
import { store } from '../../lib/store'
import { X } from 'lucide-react'

interface ContactFormModalProps {
  contact?: Contact | null
  onClose: () => void
  onSaved: () => void
}

export function ContactFormModal({ contact, onClose, onSaved }: ContactFormModalProps) {
  const [email, setEmail] = useState(contact?.email || '')
  const [firstName, setFirstName] = useState(contact?.first_name || '')
  const [lastName, setLastName] = useState(contact?.last_name || '')
  const [organization, setOrganization] = useState(contact?.organization || '')
  const [jobRole, setJobRole] = useState(contact?.job_role || '')
  const [audienceTag, setAudienceTag] = useState(contact?.audience_tag || 'high_school')
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
        job_role: jobRole.trim() || undefined,
        audience_tag: audienceTag.trim() || undefined,
      })
      if (!res.success) {
        setError(res.error || 'Failed to update contact.')
        return
      }
    } else {
      const res = store.addContact({
        email: email.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        organization: organization.trim() || undefined,
        job_role: jobRole.trim() || undefined,
        audience_tag: audienceTag.trim() || undefined,
        status: 'active',
      })
      if (!res.success) {
        setError(res.error || 'Failed to create contact.')
        return
      }
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {contact ? 'Edit Contact' : 'Add New Contact'}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. educator@school.edu"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Maria"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Vasquez"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Organization / School
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Lincoln High School"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Job Role
              </label>
              <input
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="Math Department Chair"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Audience Tag
            </label>
            <select
              value={audienceTag}
              onChange={(e) => setAudienceTag(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="high_school">high_school</option>
              <option value="district_admin">district_admin</option>
              <option value="educators">educators</option>
              <option value="nonprofit">nonprofit</option>
              <option value="general">general</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {contact ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
