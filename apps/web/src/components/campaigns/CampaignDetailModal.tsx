import { useMemo, useState } from 'react'
import type { Campaign, Contact, EmailTemplate, UserRole } from '../../types'
import { store } from '../../lib/store'
import { hasPermission } from '../../lib/rbac'
import {
  renderTemplateString,
  validateCampaignPreApproval,
  getDefaultUnsubscribeUrl,
  sanitizePreviewHtml,
} from '../../lib/templateEngine'
import { ModalShell } from '../ui/ModalShell'
import type { ToastType } from '../ui/Toast'
import {
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Ban,
  Mail,
  Zap,
  Search,
  RotateCcw,
  Edit2,
  Lock,
} from 'lucide-react'

interface CampaignDetailModalProps {
  campaign: Campaign
  template?: EmailTemplate
  contacts: Contact[]
  userRole: UserRole
  onClose: () => void
  onUpdated: () => void
  onEditCampaign?: (campaign: Campaign) => void
  onToast?: (type: ToastType, text: string) => void
}

const DEFAULT_PREVIEW_SAMPLE = {
  first_name: 'Educator',
  last_name: '',
  organization: 'School / District',
  job_role: 'Educator',
}

const WORKFLOW_STEPS: { key: Campaign['status']; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'sending', label: 'Sending' },
  { key: 'completed', label: 'Completed' },
]

function getStepIndex(status: Campaign['status']): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === status)
  return idx === -1 ? 0 : idx
}

export function CampaignDetailModal({
  campaign,
  template,
  contacts,
  userRole,
  onClose,
  onUpdated,
  onEditCampaign,
  onToast,
}: CampaignDetailModalProps) {
  const [reviewNotes, setReviewNotes] = useState(campaign.review_notes || '')
  const [actionError, setActionError] = useState<string | null>(null)
  const [recipientFilter, setRecipientFilter] = useState<string>('all')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [dispatching, setDispatching] = useState(false)

  const canReview = hasPermission(userRole, 'campaigns:review')
  const canDispatch = hasPermission(userRole, 'campaigns:dispatch')

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts]
  )

  const activeTargetContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.status === 'active' &&
          (!campaign.target_audience_tag || c.audience_tag === campaign.target_audience_tag)
      ),
    [contacts, campaign.target_audience_tag]
  )

  const recipients = store.getRecipientsForCampaign(campaign.id)

  const recipientCounts = useMemo(() => {
    let queued = 0
    let delivered = 0
    let bounced = 0
    let suppressed = 0
    recipients.forEach((r) => {
      if (r.delivery_status === 'queued') queued++
      else if (r.delivery_status === 'delivered') delivered++
      else if (r.delivery_status === 'bounced') bounced++
      else if (r.delivery_status === 'skipped_suppressed') suppressed++
    })
    const processed = delivered + bounced + suppressed
    const progressPct = recipients.length > 0 ? Math.round((processed / recipients.length) * 100) : 0
    return { queued, delivered, bounced, suppressed, processed, progressPct }
  }, [recipients])

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase()
    return recipients.filter((r) => {
      if (recipientFilter !== 'all' && r.delivery_status !== recipientFilter) return false
      if (!q) return true
      const contact = contactById.get(r.contact_id)
      return (
        (contact?.email || r.contact_id).toLowerCase().includes(q) ||
        (contact?.organization || '').toLowerCase().includes(q) ||
        `${contact?.first_name || ''} ${contact?.last_name || ''}`.toLowerCase().includes(q)
      )
    })
  }, [recipients, recipientFilter, recipientSearch, contactById])

  const validation = useMemo(
    () =>
      template
        ? validateCampaignPreApproval(template, activeTargetContacts.length)
        : { valid: false, errors: ['Associated template not found'] },
    [template, activeTargetContacts.length]
  )

  const handleSimulateBounce = (rcpId: string) => {
    store.simulateRecipientBounce(rcpId)
    onToast?.('info', 'Simulated bounce recorded and contact suppressed.')
    onUpdated()
  }

  const handleTestSend = async () => {
    setActionError(null)
    const currentUser = store.getCurrentUser()
    setSendingTest(true)
    try {
      const res = await store.sendTestEmail(campaign.id, currentUser.email)
      if (!res.success) {
        const errText = res.error || 'Failed to send test email.'
        setActionError(errText)
        onToast?.('error', errText)
        return
      }
      const modeLabel =
        res.providerMode === 'resend'
          ? 'Resend'
          : res.providerMode === 'mock'
            ? 'API mock sender'
            : 'local preview'
      onToast?.('success', `Test email sent to ${res.to} (${modeLabel}).`)
    } finally {
      setSendingTest(false)
    }
  }

  const handleSubmitForApproval = () => {
    setActionError(null)
    const res = store.submitCampaign(campaign.id)
    if (!res.success) {
      setActionError(res.errors.join(' '))
      return
    }
    onToast?.('success', 'Campaign submitted for approval.')
    onUpdated()
  }

  const handleReopenDraft = () => {
    setActionError(null)
    const res = store.reopenCampaign(campaign.id)
    if (!res.success) {
      setActionError(res.error || 'Failed to reopen campaign.')
      return
    }
    onToast?.('info', 'Campaign reopened as draft.')
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
    onToast?.(
      decision === 'approved' ? 'success' : 'info',
      `Campaign marked as ${decision}.`
    )
    onUpdated()
  }

  const handleDispatchBatch = async () => {
    setActionError(null)
    if (!store.isApiMode()) {
      const res = store.dispatchCampaignBatch(campaign.id)
      if (res.errors.length > 0) {
        setActionError(res.errors.join(' '))
        return
      }
      onToast?.('success', `Dispatched batch of ${res.sentCount} message(s).`)
      onUpdated()
      return
    }

    setDispatching(true)
    try {
      const res = await store.dispatchCampaignBatchAsync(campaign.id)
      if (res.errors.length > 0) {
        setActionError(res.errors.join(' '))
        return
      }
      onToast?.(
        'success',
        `Dispatched ${res.sentCount} message(s)${
          res.skippedSuppressed ? ` (${res.skippedSuppressed} suppressed skipped)` : ''
        }.`
      )
      onUpdated()
    } finally {
      setDispatching(false)
    }
  }

  const previewContact = activeTargetContacts[0] || DEFAULT_PREVIEW_SAMPLE

  const renderedSubject = useMemo(
    () =>
      template ? renderTemplateString(template.subject_template, { contact: previewContact }) : '',
    [template, previewContact]
  )
  const renderedBody = useMemo(
    () =>
      template
        ? sanitizePreviewHtml(
            renderTemplateString(template.body_html || template.body_text, {
              contact: previewContact,
              unsubscribeUrl: getDefaultUnsubscribeUrl('sample-token'),
            })
          )
        : '',
    [template, previewContact]
  )

  const currentStepIdx = getStepIndex(campaign.status)

  return (
    <ModalShell
      onClose={onClose}
      title={campaign.name}
      subtitle={`Template: ${template?.name || 'Unknown'} · Audience: ${
        campaign.target_audience_tag || 'All Audiences'
      } (${activeTargetContacts.length} active contacts)`}
      titleBadge={
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {campaign.status.replace('_', ' ')}
        </span>
      }
      size="2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          Close
        </button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isRejected = campaign.status === 'rejected'
              const isCompleted = !isRejected && idx < currentStepIdx
              const isCurrent = !isRejected && idx === currentStepIdx
              return (
                <li key={step.key} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-mono text-[10px]">{idx + 1}</span>
                    {step.label}
                  </span>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                      /
                    </span>
                  )}
                </li>
              )
            })}
            {campaign.status === 'rejected' && (
              <li className="ml-auto">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                  <Ban className="h-3 w-3" /> Rejected — Needs Revision
                </span>
              </li>
            )}
          </ol>
        </div>

        {actionError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Live Rendered Preview
                </div>
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={() => void handleTestSend()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  <Mail className="h-3.5 w-3.5" /> {sendingTest ? 'Sending Test...' : 'Test Send to Self'}
                </button>
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Subject:</div>
                <div className="font-semibold text-slate-900 dark:text-white">{renderedSubject}</div>
              </div>

              <div
                className="prose prose-sm dark:prose-invert mt-4 max-w-none rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
                dangerouslySetInnerHTML={{ __html: renderedBody }}
              />
            </div>

            {recipients.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Delivery Progress ({recipientCounts.processed} / {recipients.length} processed)
                  </h4>
                  <span className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {recipientCounts.progressPct}%
                  </span>
                </div>

                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${recipientCounts.progressPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                    <div className="font-bold">{recipientCounts.queued}</div>
                    <div className="text-slate-500 dark:text-slate-400">Queued</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <div className="font-bold">{recipientCounts.delivered}</div>
                    <div className="text-emerald-700 dark:text-emerald-400">Delivered</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    <div className="font-bold">{recipientCounts.bounced}</div>
                    <div className="text-rose-700 dark:text-rose-400">Bounced</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-2 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                    <div className="font-bold">{recipientCounts.suppressed}</div>
                    <div className="text-purple-700 dark:text-purple-400">Suppressed</div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Filter recipients by email or school..."
                        aria-label="Filter recipients"
                        className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <select
                      aria-label="Filter recipient status"
                      value={recipientFilter}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="all">All Statuses</option>
                      <option value="queued">Queued</option>
                      <option value="delivered">Delivered</option>
                      <option value="bounced">Bounced</option>
                      <option value="skipped_suppressed">Suppressed</option>
                    </select>
                  </div>

                  <div className="max-h-52 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="p-2">Recipient</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-slate-500 dark:text-slate-400">
                              No recipients match filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRecipients.map((rcp) => {
                            const contact = contactById.get(rcp.contact_id)
                            return (
                              <tr
                                key={rcp.id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                              >
                                <td className="p-2">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {contact?.email || rcp.contact_id}
                                  </div>
                                  {contact?.organization && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {contact.organization}
                                    </div>
                                  )}
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
                                      className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Pre-Approval Checklist
              </h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2">
                  {template?.subject_template ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>Subject template defined</span>
                </li>
                <li className="flex items-center gap-2">
                  {template?.body_html || template?.body_text ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>Email body defined</span>
                </li>
                <li className="flex items-center gap-2">
                  {(template?.body_html || '').includes('{{unsubscribe_url}}') ||
                  (template?.body_text || '').includes('{{unsubscribe_url}}') ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>Contains {'{{unsubscribe_url}}'}</span>
                </li>
                <li className="flex items-center gap-2">
                  {activeTargetContacts.length > 0 ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <span>Target active contacts &gt;= 1 ({activeTargetContacts.length})</span>
                </li>
              </ul>

              {!validation.valid && (
                <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-[11px] text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  {validation.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Approval & Dispatch Gate
              </h4>

              {campaign.review_notes && (
                <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Reviewer Notes:
                  </span>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {campaign.review_notes}
                  </p>
                  {campaign.reviewed_at && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {new Date(campaign.reviewed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {campaign.status === 'draft' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSubmitForApproval}
                    disabled={!validation.valid}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit for Approval
                  </button>
                  {onEditCampaign && (
                    <button
                      type="button"
                      onClick={() => onEditCampaign(campaign)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit Draft Settings
                    </button>
                  )}
                </div>
              )}

              {campaign.status === 'rejected' && (
                <div className="space-y-2">
                  <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    This campaign was rejected. Review the feedback, adjust settings or template,
                    and resubmit.
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {onEditCampaign && (
                      <button
                        type="button"
                        onClick={() => onEditCampaign(campaign)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Campaign
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReopenDraft}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen as Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitForApproval}
                      disabled={!validation.valid}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" /> Resubmit for Approval
                    </button>
                  </div>
                </div>
              )}

              {campaign.status === 'pending_approval' && (
                <div className="space-y-3">
                  {canReview ? (
                    <>
                      <div>
                        <label
                          htmlFor="reviewer-notes"
                          className="block text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-400"
                        >
                          Reviewer Feedback
                        </label>
                        <textarea
                          id="reviewer-notes"
                          rows={3}
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Add approval remarks or rejection guidance..."
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleReview('rejected')}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          <Ban className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview('approved')}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Approve
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Clock className="h-4 w-4" /> Pending Review
                      </div>
                      <p>Approval requires a Marketing Lead or Administrator role.</p>
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                      >
                        <Lock className="h-3 w-3" /> Review Locked (RBAC)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(campaign.status === 'approved' || campaign.status === 'sending') && (
                <div className="space-y-2">
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle className="mb-1 h-4 w-4" />
                    {campaign.status === 'sending'
                      ? `Sending in progress (${recipientCounts.queued} queued remaining).`
                      : 'Approved and ready for controlled batch dispatch.'}
                  </div>
                  {canDispatch ? (
                    <button
                      type="button"
                      disabled={dispatching}
                      onClick={() => void handleDispatchBatch()}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
                    >
                      <Zap className="h-3.5 w-3.5" />{' '}
                      {dispatching ? 'Dispatching...' : `Dispatch Batch (${campaign.batch_size} max)`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                    >
                      <Lock className="h-3.5 w-3.5" /> Dispatch Requires Lead / Admin
                    </button>
                  )}
                </div>
              )}

              {campaign.status === 'completed' && (
                <div className="rounded-lg bg-slate-100 p-2.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Campaign delivery completed. Check Analytics for delivery metrics.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
