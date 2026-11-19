import { useEffect, useMemo, useState } from 'react'
import type { Contact, ContactStatus } from '../../types'
import { apiClient, type ApiClient } from '../../lib/apiClient'
import { store } from '../../lib/store'
import { CheckCircle, AlertCircle, Shield, ArrowLeft } from 'lucide-react'

interface UnsubscribePortalProps {
  contacts: Contact[]
  onBack: () => void
  backLabel?: string
  client?: ApiClient
}

interface LookupResult {
  email: string
  organization?: string
  status: ContactStatus
  token: string
  first_name?: string
  last_name?: string
  job_role?: string
}

function readUnsubscribeTokenFromUrl(): string {
  try {
    const queryToken = new URLSearchParams(window.location.search).get('token')?.trim()
    if (queryToken) return queryToken

    const pathMatch = window.location.pathname.match(/^\/unsubscribe\/([^/]+)\/?$/)
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).trim()
    }
  } catch {
    // Ignore malformed URLs
  }
  return ''
}

export function UnsubscribePortal({
  contacts,
  onBack,
  backLabel = 'Back to Dashboard',
  client = apiClient,
}: UnsubscribePortalProps) {
  const isRemote = client.isConfigured()
  const initialUrlToken = useMemo(() => readUnsubscribeTokenFromUrl(), [])
  const [tokenInput, setTokenInput] = useState(
    () => initialUrlToken || contacts[0]?.unsubscribe_token || ''
  )
  const [lookupToken, setLookupToken] = useState<string>(() => initialUrlToken)
  const [remoteLookup, setRemoteLookup] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [justUnsubscribedEmail, setJustUnsubscribedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() => {
    if (!initialUrlToken || isRemote) return null
    const found = contacts.some((c) => c.unsubscribe_token === initialUrlToken)
    return found ? null : 'Invalid or expired unsubscribe token.'
  })

  useEffect(() => {
    if (!isRemote || !initialUrlToken) return
    let active = true
    void client
      .get<{
        valid: boolean
        email: string
        organization?: string
        current_status: ContactStatus
      }>(`/unsubscribe/${encodeURIComponent(initialUrlToken)}`, {
        skipAuth: true,
        maxRetries: 0,
      })
      .then((res) => {
        if (!active) return
        setRemoteLookup({
          email: res.email,
          organization: res.organization,
          status: res.current_status,
          token: initialUrlToken,
        })
        setError(null)
      })
      .catch(() => {
        if (!active) return
        setRemoteLookup(null)
        setError('Invalid or expired unsubscribe token.')
      })

    return () => {
      active = false
    }
  }, [client, initialUrlToken, isRemote])

  const localConfirmed = useMemo<LookupResult | null>(() => {
    if (isRemote || !lookupToken) return null
    const c = contacts.find((item) => item.unsubscribe_token === lookupToken)
    if (!c) return null
    return {
      email: c.email,
      organization: c.organization,
      status: c.status,
      token: c.unsubscribe_token,
      first_name: c.first_name,
      last_name: c.last_name,
      job_role: c.job_role,
    }
  }, [contacts, isRemote, lookupToken])

  const confirmedRecipient = isRemote ? remoteLookup : localConfirmed

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    setJustUnsubscribedEmail(null)
    const trimmed = tokenInput.trim()
    if (!trimmed) {
      setLookupToken('')
      setRemoteLookup(null)
      setError('Please enter an unsubscribe token.')
      return
    }

    if (isRemote) {
      setLoading(true)
      try {
        const res = await client.get<{
          valid: boolean
          email: string
          organization?: string
          current_status: ContactStatus
        }>(`/unsubscribe/${encodeURIComponent(trimmed)}`, { skipAuth: true, maxRetries: 0 })
        setLookupToken(trimmed)
        setRemoteLookup({
          email: res.email,
          organization: res.organization,
          status: res.current_status,
          token: trimmed,
        })
      } catch {
        setLookupToken('')
        setRemoteLookup(null)
        setError('Invalid or expired unsubscribe token.')
      } finally {
        setLoading(false)
      }
      return
    }

    const found = contacts.find((c) => c.unsubscribe_token === trimmed)
    if (!found) {
      setLookupToken('')
      setError('Invalid or expired unsubscribe token.')
      return
    }
    setLookupToken(trimmed)
  }

  const handleConfirmUnsubscribe = async () => {
    if (!confirmedRecipient || confirmedRecipient.status === 'unsubscribed') return

    if (isRemote) {
      setLoading(true)
      setError(null)
      try {
        await client.post<{ success: boolean }>(
          '/unsubscribe',
          { token: confirmedRecipient.token },
          { skipAuth: true, maxRetries: 0 }
        )
        setJustUnsubscribedEmail(confirmedRecipient.email)
        setRemoteLookup((prev) => (prev ? { ...prev, status: 'unsubscribed' } : prev))
        if (store.isApiMode()) {
          void store.hydrateFromApi()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process unsubscribe request.')
      } finally {
        setLoading(false)
      }
      return
    }

    const res = store.unsubscribeContactByToken(confirmedRecipient.token)
    if (res.success && res.contact) {
      setJustUnsubscribedEmail(res.contact.email)
    } else {
      setError('Failed to process unsubscribe request.')
    }
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            TMAS Academy Outreach Preferences
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Verify an unsubscribe token to permanently opt a recipient out of future outreach.
          </p>
        </div>

        {justUnsubscribedEmail ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-base font-semibold text-emerald-900 dark:text-emerald-200">
              Successfully Unsubscribed
            </h3>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              <strong>{justUnsubscribedEmail}</strong> has been removed from all future TMAS
              Academy outreach campaigns.
            </p>
            <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              Status updated to <code>unsubscribed</code>. CSV import re-activation is blocked.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <form onSubmit={handleLookup}>
              <label
                htmlFor="unsubscribe-token-input"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Recipient Unsubscribe Token
              </label>
              <div className="flex gap-2">
                <input
                  id="unsubscribe-token-input"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="e.g. tok-vasquez-9812"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  {loading ? 'Checking...' : 'Lookup Token'}
                </button>
              </div>
            </form>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {confirmedRecipient && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-xs">
                  <div className="text-slate-500 dark:text-slate-400">Target Recipient:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {confirmedRecipient.first_name || confirmedRecipient.last_name
                      ? `${confirmedRecipient.first_name || ''} ${confirmedRecipient.last_name || ''} (${confirmedRecipient.email})`.trim()
                      : confirmedRecipient.email}
                  </div>
                  {(confirmedRecipient.job_role || confirmedRecipient.organization) && (
                    <div className="text-slate-600 dark:text-slate-400">
                      {[confirmedRecipient.job_role, confirmedRecipient.organization]
                        .filter(Boolean)
                        .join(' at ')}
                    </div>
                  )}
                  <div className="mt-1">
                    Current Status:{' '}
                    <span className="font-mono font-bold uppercase">
                      {confirmedRecipient.status}
                    </span>
                  </div>
                </div>

                {confirmedRecipient.status === 'unsubscribed' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Already unsubscribed — this recipient will not receive further emails.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmUnsubscribe}
                    className="w-full rounded-lg bg-rose-600 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
                  >
                    {loading ? 'Processing...' : 'Confirm Opt-Out from All Outreach'}
                  </button>
                )}
              </div>
            )}

            {contacts.length > 0 && (
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sample Tokens in Workspace:
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contacts.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setTokenInput(c.unsubscribe_token)
                        setLookupToken(c.unsubscribe_token)
                        if (isRemote) {
                          setRemoteLookup({
                            email: c.email,
                            organization: c.organization,
                            status: c.status,
                            token: c.unsubscribe_token,
                            first_name: c.first_name,
                            last_name: c.last_name,
                            job_role: c.job_role,
                          })
                        }
                        setJustUnsubscribedEmail(null)
                        setError(null)
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
