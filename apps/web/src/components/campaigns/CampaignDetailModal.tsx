import { useState } from 'react'
import type { Campaign, Contact, EmailTemplate, UserRole } from '../../types'
import { store } from '../../lib/store'
import { hasPermission } from '../../lib/rbac'
import { renderTemplateString, validateCampaignPreApproval } from '../../lib/templateEngine'
import {
  X,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Ban,
  Mail,
  Zap,
} from 'lucide-react'

interface CampaignDetailModalProps {
  campaign: Campaign
  template?: EmailTemplate
  contacts: Contact[]
  userRole: UserRole
  onClose: () => void
  onUpdated: () => void
}

const DEFAULT_PREVIEW_SAMPLE = {
  first_name: 'Educator',
  last_name: '',
  organization: 'School / District',
  job_role: 'Educator',
}

export function CampaignDetailModal({
  campaign,
  template,
  contacts,
  userRole,
  onClose,
  onUpdated,
}: CampaignDetailModalProps) {
  const [reviewNotes, setReviewNotes] = useState(campaign.review_notes || '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [recipientFilter, setRecipientFilter] = useState<string>('all')

  const canReview = hasPermission(userRole, 'campaigns:review')
  const canDispatch = hasPermission(userRole, 'campaigns:dispatch')

  const targetAudienceContacts = contacts.filter((c) =>
    !campaign.target_audience_tag || c.audience_tag === campaign.target_audience_tag
  )
  const activeTargetContacts = targetAudienceContacts.filter((c) => c.status === 'active')
  const recipients = store.getRecipientsForCampaign(campaign.id)

  const filteredRecipients = recipients.filter((r) => {
    if (recipientFilter === 'all') return true
    return r.delivery_status === recipientFilter
  })

  const handleSimulateBounce = (rcpId: string) => {
    store.simulateRecipientBounce(rcpId)
    setFeedbackMsg('Simulated bounce recorded. Contact suppressed.')
    setTimeout(() => setFeedbackMsg(null), 4000)
    onUpdated()
  }

  const validation = template
    ? validateCampaignPreApproval(template, activeTargetContacts.length)
    : { valid: false, errors: ['No template found'] }

  const handleTestSend = () => {
    const currentUser = store.getCurrentUser()
    setFeedbackMsg(`Test email rendered and dispatched to ${currentUser.email}`)
    setTimeout(() => setFeedbackMsg(null), 4000)
  }

  const handleSubmitForApproval = () => {
    setActionError(null)
    const res = store.submitCampaign(campaign.id)
    if (!res.success) {
      setActionError(res.errors.join(' '))
      return
    }
    setFeedbackMsg('Campaign successfully submitted for review.')
    onUpdated()
  }

  const handleReview = (decision: 'approved' | 'rejected') => {
    setActionError(null)
    if (decision === 'rejected' && !reviewNotes.trim()) {
      setActionError('Please provide review notes explaining the rejection reason.')
      return
    }
    const res = store.reviewCampaign(campaign.id, decision, reviewNotes.trim())
    if (!res.success) {
      setActionError(res.error || 'Failed to review campaign.')
      return
    }
    setFeedbackMsg(`Campaign marked as ${decision}.`)
    onUpdated()
  }

  const handleDispatchBatch = () => {
    setActionError(null)
    const res = store.dispatchCampaignBatch(campaign.id)
    if (res.errors.length > 0) {
      setActionError(res.errors.join(' '))
      return
    }
    setFeedbackMsg(`Dispatched batch of ${res.sentCount} message(s) via Resend ESP provider.`)
    onUpdated()
  }

  const previewContact = activeTargetContacts[0] || DEFAULT_PREVIEW_SAMPLE

  const renderedSubject = template
    ? renderTemplateString(template.subject_template, { contact: previewContact })
    : ''
  const renderedBody = template
    ? renderTemplateString(template.body_html || template.body_text, {
        contact: previewContact,
        unsubscribeUrl: 'https://reach.tmasacademy.org/unsubscribe/sample-token',
      })
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-6 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {campaign.name}
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Template: {template?.name || 'Unknown'} | Audience:{' '}
              {campaign.target_audience_tag || 'All Audiences'} ({activeTargetContacts.length} active contacts)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {feedbackMsg && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {actionError && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Live Rendered Preview
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSend}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Mail className="h-3.5 w-3.5" /> Test Send to Self
                  </button>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-slate-400">Subject:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {renderedSubject}
                  </div>
                </div>

                <div
                  className="prose prose-sm dark:prose-invert mt-4 max-w-none rounded bg-slate-50/50 p-4 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200 border border-slate-100 dark:border-slate-800"
                  dangerouslySetInnerHTML={{ __html: renderedBody }}
                />
              </div>

              {recipients.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Campaign Recipient Snapshot ({recipients.length} recipients)
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded bg-slate-50 p-2 dark:bg-slate-800">
                      <div className="font-bold">
                        {recipients.filter((r) => r.delivery_status === 'queued').length}
                      </div>
                      <div className="text-slate-400">Queued</div>
                    </div>
                    <div className="rounded bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <div className="font-bold">
                        {recipients.filter((r) => r.delivery_status === 'delivered').length}
                      </div>
                      <div className="text-emerald-600">Delivered</div>
                    </div>
                    <div className="rounded bg-rose-50 p-2 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                      <div className="font-bold">
                        {recipients.filter((r) => r.delivery_status === 'bounced').length}
                      </div>
                      <div className="text-rose-600">Bounced</div>
                    </div>
                    <div className="rounded bg-purple-50 p-2 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                      <div className="font-bold">
                        {recipients.filter((r) => r.delivery_status === 'skipped_suppressed').length}
                      </div>
                      <div className="text-purple-600">Suppressed</div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Recipients
                        </span>
                        <select
                          value={recipientFilter}
                          onChange={(e) => setRecipientFilter(e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="all">All Statuses</option>
                          <option value="queued">Queued</option>
                          <option value="delivered">Delivered</option>
                          <option value="bounced">Bounced</option>
                          <option value="skipped_suppressed">Suppressed</option>
                        </select>
                      </div>

                      <div className="max-h-48 overflow-y-auto rounded border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                            <tr>
                              <th className="p-2">Recipient</th>
                              <th className="p-2">Status</th>
                              <th className="p-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredRecipients.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-3 text-center text-slate-400">
                                  No recipients match filter.
                                </td>
                              </tr>
                            ) : (
                              filteredRecipients.map((rcp) => {
                                const contact = contacts.find((c) => c.id === rcp.contact_id)
                                return (
                                  <tr key={rcp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                    <td className="p-2">
                                      <div className="font-medium text-slate-800 dark:text-slate-200">
                                        {contact?.email || rcp.contact_id}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {contact?.organization || ''}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <span
                                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                          rcp.delivery_status === 'delivered'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                            : rcp.delivery_status === 'bounced'
                                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                                            : rcp.delivery_status === 'queued'
                                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            : 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400'
                                        }`}
                                      >
                                        {rcp.delivery_status}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right">
                                      {rcp.delivery_status === 'delivered' && (
                                        <button
                                          type="button"
                                          onClick={() => handleSimulateBounce(rcp.id)}
                                          className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
                                        >
                                          Simulate Bounce
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Pre-Approval Verification
                </h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    {template?.subject_template ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>Subject template defined</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {template?.body_html || template?.body_text ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>Email body defined</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {(template?.body_html || '').includes('{{unsubscribe_url}}') ||
                    (template?.body_text || '').includes('{{unsubscribe_url}}') ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>Contains {'{{unsubscribe_url}}'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {activeTargetContacts.length > 0 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>Target active contacts &gt;= 1 ({activeTargetContacts.length})</span>
                  </li>
                </ul>

                {!validation.valid && (
                  <div className="mt-3 rounded bg-rose-50 p-2 text-[11px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    {validation.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Approval & Review Gate
                </h4>

                {campaign.review_notes && (
                  <div className="mb-3 rounded bg-slate-50 p-2.5 text-xs dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Reviewer Notes:
                    </span>
                    <p className="mt-0.5 text-slate-800 dark:text-slate-200">{campaign.review_notes}</p>
                    {campaign.reviewed_at && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(campaign.reviewed_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {campaign.status === 'draft' && (
                  <button
                    type="button"
                    onClick={handleSubmitForApproval}
                    disabled={!validation.valid}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit for Approval
                  </button>
                )}

                {campaign.status === 'pending_approval' && (
                  <div className="space-y-3">
                    {canReview ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-400">
                            Reviewer Feedback
                          </label>
                          <textarea
                            rows={3}
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add approval remarks or rejection guidance..."
                            className="mt-1 w-full rounded border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview('rejected')}
                            className="inline-flex items-center justify-center gap-1 rounded bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            <Ban className="h-3.5 w-3.5" /> Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview('approved')}
                            className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Approve
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <Clock className="mb-1 h-4 w-4" />
                        Pending review by a Marketing Lead or Administrator.
                      </div>
                    )}
                  </div>
                )}

                {campaign.status === 'approved' && (
                  <div className="space-y-2">
                    <div className="rounded bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle className="mb-1 h-4 w-4" />
                      Approved and ready for controlled batch dispatch.
                    </div>
                    {canDispatch ? (
                      <button
                        type="button"
                        onClick={handleDispatchBatch}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 shadow-sm"
                      >
                        <Zap className="h-3.5 w-3.5" /> Dispatch Batch ({campaign.batch_size} max)
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Dispatch permission requires Marketing Lead or Administrator role.
                      </div>
                    )}
                  </div>
                )}

                {campaign.status === 'completed' && (
                  <div className="rounded bg-slate-100 p-2.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Campaign delivery completed. Check analytics for delivery rates.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 p-6 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
