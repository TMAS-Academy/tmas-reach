import { useState } from 'react'
import type { Contact } from '../../types'
import { store } from '../../lib/store'
import { CheckCircle, AlertCircle, Shield, ArrowLeft } from 'lucide-react'

interface UnsubscribePortalProps {
  contacts: Contact[]
  onBack: () => void
}

export function UnsubscribePortal({ contacts, onBack }: UnsubscribePortalProps) {
  const [tokenInput, setTokenInput] = useState(contacts[0]?.unsubscribe_token || '')
  const [confirmedContact, setConfirmedContact] = useState<Contact | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = () => {
    setError(null)
    const found = contacts.find((c) => c.unsubscribe_token === tokenInput.trim())
    if (!found) {
      setError('Invalid or expired unsubscribe token.')
      setConfirmedContact(null)
      return
    }
    setConfirmedContact(found)
  }

  const handleConfirmUnsubscribe = () => {
    if (!confirmedContact) return
    const res = store.unsubscribeContactByToken(confirmedContact.unsubscribe_token)
    if (res.success && res.contact) {
      setIsSuccess(true)
      setConfirmedContact(res.contact)
    } else {
      setError('Failed to process unsubscribe request.')
    }
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Shield className="h-6 w-6 text-slate-700 dark:text-slate-300" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            TMAS Academy Outreach Preferences
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            One-click compliance unsubscribe endpoint simulation (<code>/unsubscribe/:token</code>)
          </p>
        </div>

        {isSuccess ? (
          <div className="mt-8 rounded-xl bg-emerald-50 p-6 text-center border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-base font-semibold text-emerald-900 dark:text-emerald-200">
              Successfully Unsubscribed
            </h3>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              <strong>{confirmedContact?.email}</strong> has been removed from all future TMAS Academy outreach campaigns.
            </p>
            <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              Status updated in database to <code>unsubscribed</code>. CSV import re-activation is permanently blocked.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Recipient Unsubscribe Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="e.g. tok-vasquez-9812"
                  className="w-full font-mono text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  className="rounded-md bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 shrink-0"
                >
                  Lookup Token
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {confirmedContact && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                <div className="text-xs">
                  <div className="text-slate-500">Target Recipient:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {confirmedContact.first_name} {confirmedContact.last_name} ({confirmedContact.email})
                  </div>
                  <div className="text-slate-500">
                    {confirmedContact.job_role} at {confirmedContact.organization}
                  </div>
                  <div className="mt-1">
                    Current Status: <span className="font-mono font-bold">{confirmedContact.status}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmUnsubscribe}
                  className="w-full rounded-md bg-rose-600 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
                >
                  Confirm Opt-Out from All Outreach
                </button>
              </div>
            )}

            {contacts.length > 0 && (
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Sample Tokens from Database:
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contacts.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setTokenInput(c.unsubscribe_token)
                        setConfirmedContact(c)
                        setIsSuccess(false)
                        setError(null)
                      }}
                      className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                    >
                      {c.email} ({c.unsubscribe_token})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
