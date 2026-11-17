import type { ActivityLog } from '../../types'
import { History, Shield, Database, Mail, User } from 'lucide-react'

interface ActivityLogsProps {
  logs: ActivityLog[]
}

export function ActivityLogs({ logs }: ActivityLogsProps) {
  const getActionIcon = (action: string) => {
    if (action.includes('campaign')) return <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
    if (action.includes('csv') || action.includes('contact')) return <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    if (action.includes('role') || action.includes('user')) return <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    return <Shield className="h-4 w-4 text-slate-500" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400 border border-amber-400/30 shadow-xs shadow-amber-400/10 animate-subtle-float">
          <History className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            System Activity & Audit Logs
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable audit trail mandated by Section 6 (Security and Responsible Outreach)
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <History className="mx-auto mb-2 h-6 w-6" />
                  No activity logged yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {log.actor_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5 font-mono">
                      {getActionIcon(log.action)}
                      <span>{log.action}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {log.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
