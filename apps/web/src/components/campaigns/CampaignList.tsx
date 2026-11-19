import { useMemo, useState } from 'react'
import type { Campaign, Contact, EmailTemplate, UserRole } from '../../types'
import { store } from '../../lib/store'
import { CampaignModal } from './CampaignModal'
import { CampaignDetailModal } from './CampaignDetailModal'
import type { ToastType } from '../ui/Toast'
import { Plus, Send, Clock, CheckCircle, Ban, RefreshCw, Search } from 'lucide-react'

interface CampaignListProps {
  campaigns: Campaign[]
  templates: EmailTemplate[]
  contacts: Contact[]
  userRole: UserRole
  onToast?: (type: ToastType, text: string) => void
}

export function CampaignList({
  campaigns,
  templates,
  contacts,
  userRole,
  onToast,
}: CampaignListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  )

  const selectedCampaign = useMemo(
    () => (selectedCampaignId ? campaigns.find((c) => c.id === selectedCampaignId) || null : null),
    [campaigns, selectedCampaignId]
  )

  const filteredCampaigns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return campaigns.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      const tplName = templateById.get(c.template_id)?.name || ''
      return (
        c.name.toLowerCase().includes(q) ||
        tplName.toLowerCase().includes(q) ||
        (c.target_audience_tag || 'all audiences').toLowerCase().includes(q)
      )
    })
  }, [campaigns, statusFilter, searchTerm, templateById])

  const renderStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        )
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock className="h-3 w-3" /> Pending Approval
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
            <Ban className="h-3 w-3" /> Rejected
          </span>
        )
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
            <RefreshCw className="h-3 w-3 animate-spin" /> Sending
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
            <CheckCircle className="h-3 w-3" /> Completed
          </span>
        )
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Campaigns
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Create, approve, and dispatch outreach campaigns in controlled batches.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[190px] flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search campaigns..."
              aria-label="Search campaigns"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <select
            aria-label="Filter campaigns by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="sending">Sending</option>
            <option value="completed">Completed</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setEditingCampaign(null)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Delivery Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    {campaigns.length === 0 ? (
                      <div className="mx-auto max-w-sm space-y-3 py-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-400">
                          <Send className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          No campaigns yet
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Draft an outreach campaign to send a personalized template to active
                          educators.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCampaign(null)
                            setIsModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          <Plus className="h-4 w-4" /> Create First Campaign
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        No campaigns found matching your filter.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => {
                  const tpl = templateById.get(camp.template_id)
                  const recs = store.getRecipientsForCampaign(camp.id)
                  const delivered = recs.filter((r) => r.delivery_status === 'delivered').length
                  const pct = recs.length > 0 ? Math.round((delivered / recs.length) * 100) : 0
                  return (
                    <tr key={camp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {camp.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Created {new Date(camp.created_at).toLocaleDateString()} · Batch{' '}
                          {camp.batch_size}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {tpl?.name || 'Unknown Template'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {camp.target_audience_tag || 'All Audiences'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {recs.length > 0 ? (
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              <span>
                                {delivered}/{recs.length}
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-amber-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not queued</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(camp.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCampaignId(camp.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        >
                          <Send className="h-3 w-3" /> Details & Review
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <CampaignModal
          templates={templates}
          contacts={contacts}
          campaign={editingCampaign}
          onClose={() => {
            setIsModalOpen(false)
            setEditingCampaign(null)
          }}
          onSaved={(msg) => {
            setIsModalOpen(false)
            setEditingCampaign(null)
            onToast?.('success', msg)
          }}
        />
      )}

      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          template={templateById.get(selectedCampaign.template_id)}
          contacts={contacts}
          userRole={userRole}
          onClose={() => setSelectedCampaignId(null)}
          onUpdated={() => {
            // Snapshot update via useAppStore refreshes selectedCampaign automatically
          }}
          onEditCampaign={(camp) => {
            setSelectedCampaignId(null)
            setEditingCampaign(camp)
            setIsModalOpen(true)
          }}
          onToast={onToast}
        />
      )}
    </div>
  )
}
