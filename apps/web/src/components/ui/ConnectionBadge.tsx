import { useCallback, useEffect, useState } from 'react'
import { apiClient, type ApiClient, type HealthCheckResult } from '../../lib/apiClient'
import { Cloud, HardDrive, RefreshCw, WifiOff } from 'lucide-react'

interface ConnectionBadgeProps {
  client?: ApiClient
}

export function ConnectionBadge({ client = apiClient }: ConnectionBadgeProps) {
  const configured = client.isConfigured()
  const [status, setStatus] = useState<'checking' | 'connected' | 'local' | 'fallback'>(
    configured ? 'checking' : 'local'
  )
  const [detail, setDetail] = useState<string>(
    configured
      ? 'Checking API connectivity...'
      : 'Local browser storage mode (set VITE_API_BASE_URL to connect an API server)'
  )

  const probe = useCallback(async () => {
    if (!client.isConfigured()) {
      setStatus('local')
      setDetail('Local browser storage mode (set VITE_API_BASE_URL to connect an API server)')
      return
    }
    setStatus('checking')
    const res: HealthCheckResult = await client.checkHealth()
    if (res.ok) {
      setStatus('connected')
      setDetail(
        `API connected (${client.getBaseUrl()})${res.latencyMs !== undefined ? ` • ${res.latencyMs}ms` : ''}`
      )
    } else {
      setStatus('fallback')
      setDetail(`API unreachable (${res.error || 'offline'}). Using local browser storage.`)
    }
  }, [client])

  useEffect(() => {
    if (!configured) return
    let active = true
    void client.checkHealth().then((res) => {
      if (!active) return
      if (res.ok) {
        setStatus('connected')
        setDetail(
          `API connected (${client.getBaseUrl()})${res.latencyMs !== undefined ? ` • ${res.latencyMs}ms` : ''}`
        )
      } else {
        setStatus('fallback')
        setDetail(`API unreachable (${res.error || 'offline'}). Using local browser storage.`)
      }
    })
    return () => {
      active = false
    }
  }, [client, configured])

  if (status === 'local') {
    return (
      <span
        title={detail}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300"
      >
        <HardDrive className="h-3 w-3 text-slate-500 dark:text-slate-400" />
        <span className="hidden sm:inline">Local mode</span>
      </span>
    )
  }

  if (status === 'connected') {
    return (
      <button
        type="button"
        onClick={() => void probe()}
        title={`${detail}. Click to re-check.`}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70 transition-colors"
      >
        <Cloud className="h-3 w-3" />
        <span className="hidden sm:inline">API online</span>
      </button>
    )
  }

  if (status === 'checking') {
    return (
      <span
        title={detail}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Checking</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void probe()}
      title={`${detail} Click to retry connection.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70 transition-colors"
    >
      <WifiOff className="h-3 w-3" />
      <span className="hidden sm:inline">Local fallback</span>
    </button>
  )
}
