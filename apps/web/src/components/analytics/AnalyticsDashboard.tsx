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
} from 'lucide-react'

interface AnalyticsDashboardProps {
  contacts: Contact[]
  campaigns: Campaign[]
  userRole: UserRole
}

export function AnalyticsDashboard({
  contacts,
  campaigns,
  userRole,
}: AnalyticsDashboardProps) {
  const canExport = hasPermission(userRole, 'analytics:export')

  const metrics = useMemo(() => {
    let totalQueued = 0
    let totalDelivered = 0
    let totalBounced = 0
    let totalSuppressed = 0

    campaigns.forEach((c) => {
      const recs = store.getRecipientsForCampaign(c.id)
      recs.forEach((r) => {
        if (r.delivery_status === 'queued') totalQueued++
        else if (r.delivery_status === 'delivered') totalDelivered++
        else if (r.delivery_status === 'bounced') totalBounced++
        else if (r.delivery_status === 'skipped_suppressed') totalSuppressed++
      })
    })

    const totalSent = totalDelivered + totalBounced
    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '100.0'
    const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0'

    const totalContacts = contacts.length
    const activeContacts = contacts.filter((c) => c.status === 'active').length
    const unsubContacts = contacts.filter((c) => c.status === 'unsubscribed').length
    const unsubRate =
      totalContacts > 0 ? ((unsubContacts / totalContacts) * 100).toFixed(1) : '0.0'

    return {
      totalContacts,
      activeContacts,
      unsubContacts,
      unsubRate,
      totalQueued,
      totalDelivered,
      totalBounced,
      totalSuppressed,
      totalSent,
      deliveryRate,
      bounceRate,
    }
  }, [contacts, campaigns])

  const handleExport = () => {
    if (!canExport) return
    const csvContent = [
      'Campaign,Status,TargetAudience,BatchSize,CreatedDate',
      ...campaigns.map(
        (c) =>
          `"${c.name}","${c.status}","${c.target_audience_tag || 'All'}","${c.batch_size}","${c.created_at}"`
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
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400 border border-amber-400/30 shadow-xs shadow-amber-400/10 animate-subtle-float">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Campaign Analytics
            </h3>
          </div>
        </div>

        <div>
          {canExport ? (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" /> Export Analytics CSV
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              Read-Only Mode (Export requires Lead or Admin permission)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Delivery Rate</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <MailCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.deliveryRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {metrics.totalDelivered} delivered messages
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Hard Bounce Rate</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.bounceRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {metrics.totalBounced} invalid/bounced addresses
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Unsubscribe Rate</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.unsubRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {metrics.unsubContacts} contacts opted out
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Reach Pool</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.activeContacts}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            of {metrics.totalContacts} total contacts
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Campaign Delivery Pipeline
            </h4>
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
                    width: `${metrics.totalSent + metrics.totalQueued > 0 ? (metrics.totalQueued / (metrics.totalSent + metrics.totalQueued)) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Delivered Successfully</span>
                <span className="font-semibold text-emerald-600">{metrics.totalDelivered}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${metrics.deliveryRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Hard Bounces</span>
                <span className="font-semibold text-rose-600">{metrics.totalBounced}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-rose-500"
                  style={{ width: `${metrics.bounceRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Suppressed / Blocked from Outreach</span>
                <span className="font-semibold text-purple-600">{metrics.totalSuppressed}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-2 rounded-full bg-purple-500"
                  style={{
                    width: `${metrics.totalContacts > 0 ? (metrics.totalSuppressed / metrics.totalContacts) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Send className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Campaigns Summary
            </h4>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {campaigns.slice(0, 4).map((c) => (
              <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Audience: {c.target_audience_tag || 'All'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {c.status}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Batch: {c.batch_size}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
