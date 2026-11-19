import { useCallback, useEffect, useState } from 'react'
import { apiClient, type ApiClient } from '../../lib/apiClient'
import type { ToastType } from '../ui/Toast'
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

type ReadinessStatus = 'pass' | 'warn' | 'fail'

interface ReadinessCheckItem {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
  envVar?: string
}

interface ReadinessReport {
  readyForLiveOutreach: boolean
  environment: string
  providerMode: 'resend' | 'mock'
  checks: ReadinessCheckItem[]
}

interface ResendDnsRecord {
  record: string
  name: string
  type: string
  value: string
  status?: string
}

interface ResendDomainResult {
  configured: boolean
  domain: string
  verified: boolean
  status: string
  records?: ResendDnsRecord[]
  message: string
}

interface ReadinessPanelProps {
  isApiMode: boolean
  onToast?: (type: ToastType, text: string) => void
  client?: ApiClient
}

export function ReadinessPanel({
  isApiMode,
  onToast,
  client = apiClient,
}: ReadinessPanelProps) {
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [domainResult, setDomainResult] = useState<ResendDomainResult | null>(null)

  const fetchReadiness = useCallback(async () => {
    if (!isApiMode) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await client.get<ReadinessReport>('/api/system/readiness', { maxRetries: 1 })
      setReport(res)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load readiness checks.')
    } finally {
      setLoading(false)
    }
  }, [client, isApiMode])

  useEffect(() => {
    if (!isApiMode) return
    let active = true
    void client
      .get<ReadinessReport>('/api/system/readiness', { maxRetries: 1 })
      .then((res) => {
        if (!active) return
        setReport(res)
        setLoadError(null)
      })
      .catch((err) => {
        if (!active) return
        setLoadError(err instanceof Error ? err.message : 'Unable to load readiness checks.')
      })
    return () => {
      active = false
    }
  }, [client, isApiMode])

  const handleVerifyDomain = async () => {
    if (!isApiMode) return
    setVerifyingDomain(true)
    try {
      const res = await client.post<ResendDomainResult>(
        '/api/system/verify-domain',
        undefined,
        { maxRetries: 0 }
      )
      setDomainResult(res)
      onToast?.(res.verified ? 'success' : 'info', res.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Domain verification request failed.'
      setDomainResult({
        configured: true,
        domain: '',
        verified: false,
        status: 'error',
        message: msg,
      })
      onToast?.('error', msg)
    } finally {
      setVerifyingDomain(false)
    }
  }

  if (!isApiMode) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Production Readiness (Local Demo Mode)
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              This browser session is running in local storage mode. Configure{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                VITE_API_BASE_URL
              </code>{' '}
              to connect to the TMAS Reach API for live JWT authentication, shared SQLite
              persistence, and Resend domain verification checks.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              report?.readyForLiveOutreach
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Production Readiness
              </h3>
              {report && (
                <>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      report.readyForLiveOutreach
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {report.readyForLiveOutreach
                      ? 'Ready for live outreach'
                      : 'Action required before live sending'}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    env: {report.environment}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    sender: {report.providerMode === 'resend' ? 'Resend' : 'Mock'}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Live backend configuration checks and Resend sending-domain status.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchReadiness()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh checks</span>
          </button>

          <button
            type="button"
            disabled={verifyingDomain}
            onClick={() => void handleVerifyDomain()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{verifyingDomain ? 'Verifying...' : 'Verify Resend Domain'}</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
        >
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {report.checks.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
            >
              {item.status === 'pass' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : item.status === 'warn' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  {item.envVar && (
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {item.envVar}
                    </code>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {domainResult && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            domainResult.verified
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{domainResult.message}</span>
            {domainResult.domain && (
              <span className="rounded bg-white/80 px-2 py-0.5 font-mono text-[11px] text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {domainResult.domain} ({domainResult.status})
              </span>
            )}
          </div>

          {domainResult.records && domainResult.records.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5">Type</th>
                    <th className="px-2.5 py-1.5">Name</th>
                    <th className="px-2.5 py-1.5">Value</th>
                    <th className="px-2.5 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {domainResult.records.map((rec, idx) => (
                    <tr key={`${rec.type}-${rec.name}-${idx}`}>
                      <td className="px-2.5 py-1.5">{rec.type}</td>
                      <td className="px-2.5 py-1.5">{rec.name}</td>
                      <td className="px-2.5 py-1.5 break-all">{rec.value}</td>
                      <td className="px-2.5 py-1.5">{rec.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
