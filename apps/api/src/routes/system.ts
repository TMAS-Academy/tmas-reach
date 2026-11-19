import type { ApiRequest, ApiResponse, Router } from '../server.js'
import { getConfig, type ApiConfig } from '../lib/config.js'
import { requireMinimumRole } from '../middleware/rbac.js'
import { usersDb } from './auth.js'

export type ReadinessStatus = 'pass' | 'warn' | 'fail'

export interface ReadinessCheckItem {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
  envVar?: string
}

export interface ReadinessReport {
  readyForLiveOutreach: boolean
  environment: string
  providerMode: 'resend' | 'mock'
  checks: ReadinessCheckItem[]
}

export interface ResendDnsRecord {
  record: string
  name: string
  type: string
  value: string
  status?: string
}

export interface ResendDomainVerificationResult {
  configured: boolean
  domain: string
  verified: boolean
  status: string
  records?: ResendDnsRecord[]
  message: string
}

function extractSenderDomain(fromAddress: string): string {
  const angleMatch = fromAddress.match(/<[^>]*@([^>\s]+)>/)
  if (angleMatch) return angleMatch[1].trim().toLowerCase()
  const atIndex = fromAddress.lastIndexOf('@')
  if (atIndex !== -1) return fromAddress.slice(atIndex + 1).trim().toLowerCase()
  return ''
}

function isLocalHostname(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
  } catch {
    return false
  }
}

export function evaluateReadiness(config: ApiConfig = getConfig()): ReadinessReport {
  const hasRealResendKey = Boolean(
    config.resendApiKey && config.resendApiKey.trim() !== '' && config.resendApiKey !== 'your-resend-api-key'
  )
  const senderDomain = extractSenderDomain(config.emailFromAddress)
  const isExampleSender =
    !config.emailFromAddress ||
    config.emailFromAddress === 'outreach@example.com' ||
    senderDomain === 'example.com'

  const hasCustomAuthSecret =
    Boolean(config.authSecret) &&
    config.authSecret !== 'dev_insecure_auth_secret_change_me' &&
    config.authSecret.length >= 32

  const hasCustomWebhookSecret =
    Boolean(config.webhookSigningSecret) &&
    config.webhookSigningSecret !== 'test_webhook_secret_tmas' &&
    config.webhookSigningSecret !== 'your-webhook-signing-secret'

  const hasPersistentSqlite = Boolean(
    config.sqliteDbPath && config.sqliteDbPath.trim() !== '' && config.sqliteDbPath !== ':memory:'
  )

  const hasRestrictedCors =
    config.corsOrigin !== '*' && !isLocalHostname(config.corsOrigin.split(',')[0]?.trim() || '')

  let publicUrlStatus: ReadinessStatus = 'pass'
  let publicUrlDetail = `Public unsubscribe URL set to ${config.appPublicUrl}.`
  try {
    const parsed = new URL(config.appPublicUrl)
    if (isLocalHostname(config.appPublicUrl)) {
      publicUrlStatus = 'warn'
      publicUrlDetail = 'APP_PUBLIC_URL points to localhost; external recipients cannot open unsubscribe links.'
    } else if (parsed.protocol !== 'https:') {
      publicUrlStatus = 'warn'
      publicUrlDetail = 'APP_PUBLIC_URL should use https:// in production.'
    }
  } catch {
    publicUrlStatus = 'fail'
    publicUrlDetail = 'APP_PUBLIC_URL is not a valid URL.'
  }

  let emailStatus: ReadinessStatus = 'fail'
  let emailDetail = 'RESEND_API_KEY is not set; outbound campaigns are running in mock mode.'
  if (hasRealResendKey && !isExampleSender) {
    emailStatus = 'pass'
    emailDetail = `Configured to send from ${config.emailFromAddress} via Resend.`
  } else if (hasRealResendKey && isExampleSender) {
    emailStatus = 'warn'
    emailDetail = 'RESEND_API_KEY is set, but EMAIL_FROM_ADDRESS still uses example.com.'
  }

  const hasActiveAdmin = usersDb.some((u) => u.role === 'administrator' && u.is_active)

  const checks: ReadinessCheckItem[] = [
    {
      id: 'auth_secret',
      label: 'JWT signing secret',
      status: hasCustomAuthSecret ? 'pass' : 'fail',
      detail: hasCustomAuthSecret
        ? 'AUTH_SECRET is configured with 32+ characters.'
        : 'Set AUTH_SECRET to a random string of at least 32 characters.',
      envVar: 'AUTH_SECRET',
    },
    {
      id: 'dev_auth_disabled',
      label: 'Header auth bypass disabled',
      status: config.allowDevAuth ? 'fail' : 'pass',
      detail: config.allowDevAuth
        ? 'Dev header authentication is enabled. Run with NODE_ENV=production and unset ALLOW_DEV_AUTH.'
        : 'Only signed JWT bearer tokens are accepted.',
      envVar: 'NODE_ENV',
    },
    {
      id: 'persistence',
      label: 'Persistent database storage',
      status: hasPersistentSqlite ? 'pass' : 'fail',
      detail: hasPersistentSqlite
        ? `SQLite WAL database configured at ${config.sqliteDbPath}.`
        : 'SQLITE_DB_PATH is unset; server state is held only in memory and resets on restart.',
      envVar: 'SQLITE_DB_PATH',
    },
    {
      id: 'cors_origin',
      label: 'Restricted CORS origin',
      status:
        config.corsOrigin === '*'
          ? 'fail'
          : hasRestrictedCors
            ? 'pass'
            : 'warn',
      detail:
        config.corsOrigin === '*'
          ? 'CORS_ORIGIN is wildcard (*). Restrict it to your frontend origin.'
          : hasRestrictedCors
            ? `CORS restricted to ${config.corsOrigin}.`
            : `CORS_ORIGIN (${config.corsOrigin}) points to localhost.`,
      envVar: 'CORS_ORIGIN',
    },
    {
      id: 'public_url',
      label: 'Public unsubscribe base URL',
      status: publicUrlStatus,
      detail: publicUrlDetail,
      envVar: 'APP_PUBLIC_URL',
    },
    {
      id: 'email_provider',
      label: 'Email service provider (Resend)',
      status: emailStatus,
      detail: emailDetail,
      envVar: 'RESEND_API_KEY / EMAIL_FROM_ADDRESS',
    },
    {
      id: 'webhook_secret',
      label: 'Webhook signature secret',
      status: hasCustomWebhookSecret ? 'pass' : 'fail',
      detail: hasCustomWebhookSecret
        ? 'WEBHOOK_SIGNING_SECRET is configured.'
        : 'Set WEBHOOK_SIGNING_SECRET from your Resend webhook endpoint settings.',
      envVar: 'WEBHOOK_SIGNING_SECRET',
    },
    {
      id: 'admin_account',
      label: 'Active administrator account',
      status: hasActiveAdmin ? 'pass' : 'fail',
      detail: hasActiveAdmin
        ? 'At least one active administrator account exists.'
        : 'Create or seed an active administrator account.',
    },
  ]

  return {
    readyForLiveOutreach: checks.every((c) => c.status === 'pass'),
    environment: config.nodeEnv,
    providerMode: hasRealResendKey ? 'resend' : 'mock',
    checks,
  }
}

export async function verifyResendDomain(
  config: ApiConfig = getConfig(),
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<ResendDomainVerificationResult> {
  const domain = extractSenderDomain(config.emailFromAddress)
  const apiKey = config.resendApiKey?.trim()

  if (!apiKey || apiKey === 'your-resend-api-key') {
    return {
      configured: false,
      domain,
      verified: false,
      status: 'not_configured',
      message: 'RESEND_API_KEY is not configured on the API server.',
    }
  }

  if (!domain) {
    return {
      configured: true,
      domain: '',
      verified: false,
      status: 'invalid_from_address',
      message: 'EMAIL_FROM_ADDRESS does not contain a valid sender domain.',
    }
  }

  const fetchFn = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000

  try {
    const response = await fetchFn('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })

    const body = (await response.json().catch(() => null)) as {
      data?: Array<{
        name?: string
        status?: string
        records?: ResendDnsRecord[]
      }>
      message?: string
    } | null

    if (!response.ok) {
      return {
        configured: true,
        domain,
        verified: false,
        status: `api_error_${response.status}`,
        message: body?.message || `Resend domains API returned HTTP ${response.status}.`,
      }
    }

    const domains = Array.isArray(body?.data) ? body.data : []
    const matched = domains.find((d) => {
      const candidate = d.name?.trim().toLowerCase()
      return candidate === domain || (candidate ? domain.endsWith(`.${candidate}`) : false)
    })

    if (!matched) {
      return {
        configured: true,
        domain,
        verified: false,
        status: 'not_found',
        message: `Domain "${domain}" was not found in your Resend account.`,
      }
    }

    const domainStatus = matched.status || 'unknown'
    const isVerified = domainStatus === 'verified'
    return {
      configured: true,
      domain,
      verified: isVerified,
      status: domainStatus,
      records: Array.isArray(matched.records) ? matched.records : undefined,
      message: isVerified
        ? `Domain "${domain}" is verified in Resend.`
        : `Domain "${domain}" has status "${domainStatus}". Complete DNS records in Resend.`,
    }
  } catch (err) {
    return {
      configured: true,
      domain,
      verified: false,
      status: 'network_error',
      message: err instanceof Error ? err.message : 'Unable to reach Resend API.',
    }
  }
}

export function registerSystemRoutes(router: Router) {
  router.get('/api/system/readiness', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    res.status(200).json(evaluateReadiness())
  })

  router.post('/api/system/verify-domain', async (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    const result = await verifyResendDomain()
    res.status(200).json(result)
  })
}
