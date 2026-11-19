import { useMemo, useState } from 'react'
import type { ActivityLog } from '../../types'
import { History, Shield, Database, Mail, User, Search, Download, X } from 'lucide-react'

interface ActivityLogsProps {
  logs: ActivityLog[]
}

const PAGE_SIZE = 15

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function formatMetadataEntries(metadata?: Record<string, unknown>): [string, string][] {
  if (!metadata) return []
  return Object.entries(metadata)
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => [
      key.replace(/_/g, ' '),
      typeof val === 'object' ? JSON.stringify(val) : String(val),
    ])
}

export function ActivityLogs({ logs }: ActivityLogsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const entityTypes = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((l) => {
      if (l.entity_type) set.add(l.entity_type)
    })
    return Array.from(set).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return logs.filter((log) => {
      if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false
      if (!q) return true
      const metaText = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : ''
      return (
        log.actor_name.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        metaText.includes(q)
      )
    })
  }, [logs, searchTerm, entityFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasFilters = searchTerm.trim() !== '' || entityFilter !== 'all'

  const handleExportCsv = () => {
    const headers = 'timestamp,actor,action,entity_type,entity_id,metadata'
    const rows = filteredLogs.map((log) =>
      [
        log.created_at,
        log.actor_name,
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.metadata ? JSON.stringify(log.metadata) : '',
      ]
        .map(escapeCsvCell)
        .join(',')
    )
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmas_activity_logs.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getActionIcon = (action: string) => {
    if (action.includes('campaign') || action.includes('batch')) {
      return <Mail className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    }
    if (action.includes('csv') || action.includes('contact') || action.includes('survey')) {
      return <Database className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    }
    if (action.includes('role') || action.includes('user')) {
      return <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    }
    return <Shield className="h-3.5 w-3.5 text-slate-500" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-700 dark:text-amber-400">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Activity Log
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Chronological audit trail of contact imports, approvals, dispatches, and role updates.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" /> Export Logs CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search actor, action, or details..."
            aria-label="Search activity logs"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <select
          aria-label="Filter by entity type"
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="all">All Entities</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setEntityFilter('all')
              setCurrentPage(1)
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    <History className="mx-auto mb-2 h-6 w-6 opacity-60" />
                    {logs.length === 0
                      ? 'No activity logged yet.'
                      : 'No activity entries match your filters.'}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const entries = formatMetadataEntries(log.metadata)
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {log.actor_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-200">
                          {getActionIcon(log.action)}
                          <span>{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entries.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {entries.map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800/70"
                              >
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                  {k}:
                                </span>
                                <span className="max-w-[200px] truncate font-mono text-slate-800 dark:text-slate-200" title={v}>
                                  {v}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <div>
              Showing {(safePage - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(safePage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
