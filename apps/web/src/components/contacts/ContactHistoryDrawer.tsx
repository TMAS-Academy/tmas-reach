import { useMemo } from 'react'
import type { Contact, Campaign, UserRole } from '../../types'
import { store } from '../../lib/store'
import { hasPermission } from '../../lib/rbac'
import { ModalShell } from '../ui/ModalShell'
import { Mail, Clock, Building, Briefcase, Tag, MapPin } from 'lucide-react'

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
    <ModalShell
      variant="drawer"
      size="md"
      onClose={onClose}
      title="Contact Profile & Outreach"
      subtitle={contact.email}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          Close
        </button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="text-base font-bold text-slate-900 dark:text-white">
            {contact.first_name || contact.last_name
              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
              : 'No Name Stored'}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Building className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{contact.organization || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{contact.job_role || '—'}</span>
            </div>
          </div>

          {contact.district && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{contact.district}</span>
            </div>
          )}

          {contact.notes && (
            <p className="rounded-lg bg-white/80 p-2.5 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70">
              {contact.notes}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs dark:border-slate-800">
            <div className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
              <Tag className="h-3 w-3" />
              <span>{contact.audience_tag || 'none'}</span>
            </div>
            <div>
              Status:{' '}
              <span className="font-mono font-semibold uppercase text-slate-800 dark:text-slate-200">
                {contact.status}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Compliance & Suppression
          </span>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Unsubscribe Token:{' '}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {contact.unsubscribe_token}
            </span>
          </div>

          {canSuppress && (
            <div className="pt-1">
              {contact.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('suppressed')}
                  className="w-full rounded-lg border border-purple-200 bg-purple-50 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  Manually Suppress Contact
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleStatus('active')}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  Restore to Active Outreach
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Outreach History ({outreachHistory.length})
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Last Contacted:{' '}
              {contact.last_contacted_at
                ? new Date(contact.last_contacted_at).toLocaleDateString()
                : 'Never'}
            </span>
          </div>

          {outreachHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <Mail className="mx-auto mb-2 h-6 w-6 text-slate-400 dark:text-slate-600" />
              No campaigns dispatched to this contact yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {outreachHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between font-medium text-slate-900 dark:text-white">
                    <span>{item.campaign.name}</span>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      {item.deliveryStatus}
                    </span>
                  </div>
                  {item.sentAt && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>Sent {new Date(item.sentAt).toLocaleString()}</span>
                    </div>
                  )}
                  {item.messageId && (
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      Provider ID: {item.messageId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
