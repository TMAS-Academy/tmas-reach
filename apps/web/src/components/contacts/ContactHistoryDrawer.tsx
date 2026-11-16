import { useMemo } from 'react'
import type { Contact, Campaign, UserRole } from '../../types'
import { store } from '../../lib/store'
import { hasPermission } from '../../lib/rbac'
import {
  X,
  Mail,
  Clock,
  Building,
  Briefcase,
  Tag,
} from 'lucide-react'

interface ContactHistoryDrawerProps {
  contact: Contact
  campaigns: Campaign[]
  userRole: UserRole
  onClose: () => void
  onStatusChanged: () => void
}

export function ContactHistoryDrawer({
  contact,
  campaigns,
  userRole,
  onClose,
  onStatusChanged,
}: ContactHistoryDrawerProps) {
  const canSuppress = hasPermission(userRole, 'contacts:suppress')

  const outreachHistory = useMemo(() => {
    const list: {
      campaign: Campaign
      deliveryStatus: string
      sentAt?: string
      messageId?: string
    }[] = []

    campaigns.forEach((camp) => {
      const recs = store.getRecipientsForCampaign(camp.id)
      const match = recs.find((r) => r.contact_id === contact.id)
      if (match) {
        list.push({
          campaign: camp,
          deliveryStatus: match.delivery_status,
          sentAt: match.sent_at,
          messageId: match.provider_message_id,
        })
      }
    })

    return list
  }, [contact, campaigns])

  const handleToggleStatus = (newStatus: 'active' | 'suppressed') => {
    if (newStatus === 'suppressed' && !canSuppress) return
    store.setContactStatus(contact.id, newStatus)
    onStatusChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Contact Profile & Outreach</h3>
            <p className="text-xs text-slate-500 font-mono">{contact.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {contact.first_name || contact.last_name
                ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                : 'No Name Stored'}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <span>{contact.organization || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>{contact.job_role || '—'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1 text-slate-500 font-mono">
                <Tag className="h-3 w-3" />
                <span>Tag: {contact.audience_tag || 'none'}</span>
              </div>
              <div>
                Status: <span className="font-semibold uppercase font-mono">{contact.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Compliance & Suppression
            </span>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Unsubscribe Token:{' '}
              <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {contact.unsubscribe_token}
              </span>
            </div>

            {canSuppress && (
              <div className="pt-2">
                {contact.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus('suppressed')}
                    className="w-full rounded-md border border-purple-200 bg-purple-50 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    Manually Suppress Contact
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus('active')}
                    className="w-full rounded-md border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Restore to Active Outreach
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Outreach History ({outreachHistory.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Last Contacted:{' '}
                {contact.last_contacted_at
                  ? new Date(contact.last_contacted_at).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>

            {outreachHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800">
                <Mail className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
                No campaigns dispatched to this contact yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {outreachHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-medium text-slate-900 dark:text-white">
                      <span>{item.campaign.name}</span>
                      <span className="font-mono text-[11px] text-emerald-600">
                        {item.deliveryStatus}
                      </span>
                    </div>
                    {item.sentAt && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>Sent {new Date(item.sentAt).toLocaleString()}</span>
                      </div>
                    )}
                    {item.messageId && (
                      <div className="text-[10px] font-mono text-slate-400">
                        Provider ID: {item.messageId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
