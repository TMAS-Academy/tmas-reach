import { useState } from 'react'
import type { Campaign, Contact, EmailTemplate, UserRole } from '../../types'
import { store } from '../../lib/store'
import { CampaignModal } from './CampaignModal'
import { CampaignDetailModal } from './CampaignDetailModal'
import { Plus, Send, Clock, CheckCircle, Ban, RefreshCw } from 'lucide-react'

interface CampaignListProps {
  campaigns: Campaign[]
  templates: EmailTemplate[]
  contacts: Contact[]
  userRole: UserRole
}

export function CampaignList({ campaigns, templates, contacts, userRole }: CampaignListProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredCampaigns = campaigns.filter(
    (c) => statusFilter === 'all' || c.status === statusFilter
  )

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
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
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
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400 border border-amber-400/30 shadow-xs shadow-amber-400/10 animate-subtle-float">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Campaigns
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800/90"
          >
            <option value="all">All Campaign Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="sending">Sending</option>
            <option value="completed">Completed</option>
          </select>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-black hover:bg-amber-300 shadow-sm shadow-amber-400/20 transition-all hover:scale-103 active:scale-97 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Batch Size</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No campaigns found matching the filter.
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((camp) => {
                const tpl = templates.find((t) => t.id === camp.template_id)
                return (
                  <tr key={camp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{camp.name}</div>
                      <div className="text-xs text-slate-400">
                        Created {new Date(camp.created_at).toLocaleDateString()}
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
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {camp.batch_size}
                    </td>
                    <td className="px-4 py-3">{renderStatusBadge(camp.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCampaign(camp)}
                        className="inline-flex items-center gap-1 rounded bg-slate-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
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

      {isCreateOpen && (
        <CampaignModal
          templates={templates}
          onClose={() => setIsCreateOpen(false)}
          onSaved={() => setIsCreateOpen(false)}
        />
      )}

      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          template={templates.find((t) => t.id === selectedCampaign.template_id)}
          contacts={contacts}
          userRole={userRole}
          onClose={() => setSelectedCampaign(null)}
          onUpdated={() => {
            const updated = store.getCampaigns().find((c) => c.id === selectedCampaign.id)
            setSelectedCampaign(updated || null)
          }}
        />
      )}
    </div>
  )
}
