import { useMemo } from 'react'
import type { Campaign, Contact, UserRole } from '../../types'
import { hasPermission } from '../../lib/rbac'
import { store } from '../../lib/store'
import {
  TrendingUp,
  BarChart2,
  MailCheck,
  AlertOctagon,
  UserX,
  Send,
  Download,
  Users,
  School,
} from 'lucide-react'

interface AnalyticsDashboardProps {
  contacts: Contact[]
  campaigns: Campaign[]
  userRole: UserRole
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function AnalyticsDashboard({
  contacts,
  campaigns,
  userRole,
}: AnalyticsDashboardProps) {
  const canExport = hasPermission(userRole, 'analytics:export')

  const { metrics, schoolBreakdown } = useMemo(() => {
    const campaignIds = new Set(campaigns.map((c) => c.id))
    const contactById = new Map<string, Contact>()
    const schoolMap = new Map<
      string,
      { school: string; district: string; contacts: number; delivered: number; bounced: number }
    >()

    let activeContacts = 0
    let unsubContacts = 0

    contacts.forEach((c) => {
      contactById.set(c.id, c)
      if (c.status === 'active') activeContacts++
      else if (c.status === 'unsubscribed') unsubContacts++

      const school = c.organization?.trim() || 'Unassigned School'
      const district = c.district?.trim() || '—'
      const key = `${school}:::${district}`
      const existing = schoolMap.get(key)
      if (existing) {
        existing.contacts++
      } else {
        schoolMap.set(key, { school, district, contacts: 1, delivered: 0, bounced: 0 })
      }
    })

    let totalQueued = 0
    let totalDelivered = 0
    let totalBounced = 0
    let totalSuppressed = 0

    const allRecipients = store.getAllRecipients()
    allRecipients.forEach((r) => {
      if (!campaignIds.has(r.campaign_id)) return

      if (r.delivery_status === 'queued') totalQueued++
      else if (r.delivery_status === 'delivered') totalDelivered++
      else if (r.delivery_status === 'bounced') totalBounced++
      else if (r.delivery_status === 'skipped_suppressed') totalSuppressed++

      if (r.delivery_status === 'delivered' || r.delivery_status === 'bounced') {
        const contact = contactById.get(r.contact_id)
        if (!contact) return
        const school = contact.organization?.trim() || 'Unassigned School'
        const district = contact.district?.trim() || '—'
        const bucket = schoolMap.get(`${school}:::${district}`)
        if (bucket) {
          if (r.delivery_status === 'delivered') bucket.delivered++
          else bucket.bounced++
        }
      }
    })

    const totalSent = totalDelivered + totalBounced
    const deliveryRatePct = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const bounceRatePct = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0
    const deliveryRateDisplay = totalSent > 0 ? `${deliveryRatePct.toFixed(1)}%` : '—'
    const bounceRateDisplay = totalSent > 0 ? `${bounceRatePct.toFixed(1)}%` : '—'

    const totalContacts = contacts.length
    const unsubRateDisplay =
      totalContacts > 0 ? `${((unsubContacts / totalContacts) * 100).toFixed(1)}%` : '0.0%'

    return {
      metrics: {
        totalContacts,
        activeContacts,
        unsubContacts,
        unsubRateDisplay,
        totalQueued,
        totalDelivered,
        totalBounced,
        totalSuppressed,
        totalSent,
        deliveryRatePct,
        bounceRatePct,
        deliveryRateDisplay,
        bounceRateDisplay,
      },
      schoolBreakdown: Array.from(schoolMap.values()).sort((a, b) => b.contacts - a.contacts),
    }
  }, [contacts, campaigns])

  const handleExport = () => {
    if (!canExport) return
    const csvContent = [
      'Campaign,Status,TargetAudience,BatchSize,CreatedDate',
      ...campaigns.map((c) =>
        [
          c.name,
          c.status,
          c.target_audience_tag || 'All',
          String(c.batch_size),
          c.created_at,
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tmas_reach_campaign_analytics_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Campaign Analytics
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Delivery health, bounce suppression, and school-level outreach metrics.
            </p>
          </div>
        </div>

        <div>
          {canExport ? (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <Download className="h-3.5 w-3.5" /> Export Analytics CSV
            </button>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Read-only mode (Export requires Lead or Admin role)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-xs font-medium">Delivery Rate</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <MailCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.deliveryRateDisplay}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.totalDelivered} delivered messages
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-xs font-medium">Hard Bounce Rate</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.bounceRateDisplay}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.totalBounced} invalid/bounced addresses
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-xs font-medium">Unsubscribe Rate</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.unsubRateDisplay}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.unsubContacts} contacts opted out
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-xs font-medium">Active Reach Pool</span>
            <div className="rounded-lg bg-amber-400/15 p-2 text-amber-700 dark:text-amber-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.activeContacts}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            of {metrics.totalContacts} total contacts
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Campaign Delivery Pipeline
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Queued for Dispatch</span>
                <span className="font-semibold">{metrics.totalQueued}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-slate-400"
                  style={{
                    width: `${
                      metrics.totalSent + metrics.totalQueued > 0
                        ? (metrics.totalQueued / (metrics.totalSent + metrics.totalQueued)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Delivered Successfully</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {metrics.totalDelivered}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${metrics.deliveryRatePct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Hard Bounces</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {metrics.totalBounced}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-rose-500"
                  style={{ width: `${metrics.bounceRatePct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Suppressed / Blocked from Outreach</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {metrics.totalSuppressed}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-purple-500"
                  style={{
                    width: `${
                      metrics.totalContacts > 0
                        ? Math.min(100, (metrics.totalSuppressed / metrics.totalContacts) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Campaigns Summary
            </h3>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No campaigns created yet. Launch a campaign to see recent delivery summaries here.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {campaigns.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      Audience: {c.target_audience_tag || 'All'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {c.status.replace('_', ' ')}
                    </span>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      Batch: {c.batch_size}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <School className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Outreach by School & District
          </h3>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="p-2.5">School / Organization</th>
                <th className="p-2.5">District</th>
                <th className="p-2.5 text-right">Contacts</th>
                <th className="p-2.5 text-right">Delivered</th>
                <th className="p-2.5 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {schoolBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400">
                    No school or district data available yet.
                  </td>
                </tr>
              ) : (
                schoolBreakdown.map((row, idx) => {
                  const rate =
                    row.delivered + row.bounced > 0
                      ? `${Math.round((row.delivered / (row.delivered + row.bounced)) * 100)}%`
                      : '—'
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">
                        {row.school}
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.district}</td>
                      <td className="p-2.5 text-right font-semibold">{row.contacts}</td>
                      <td className="p-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.delivered}
                      </td>
                      <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">{rate}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
