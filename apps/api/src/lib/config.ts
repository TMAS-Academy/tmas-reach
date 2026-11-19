export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface ApiConfig {
  port: number
  nodeEnv: string
  corsOrigin: string
  appPublicUrl: string
  authSecret: string
  authTokenTtlSec: number
  allowDevAuth: boolean
  bootstrapAdminEmail?: string
  bootstrapAdminPassword?: string
  bootstrapAdminName: string
  webhookSigningSecret: string
  resendApiKey?: string
  emailFromAddress: string
  sqliteDbPath?: string
  bodyLimitBytes: number
  rateLimitPerSec: number
  schedulerIntervalMs: number
  logLevel: LogLevel
}

const VALID_LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent']

function parseNonNegativeInt(raw: string | undefined, fallback: number, max?: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  if (max !== undefined && parsed > max) return fallback
  return parsed
}

function parsePositiveInt(raw: string | undefined, fallback: number, max?: number): number {
  const parsed = parseNonNegativeInt(raw, fallback, max)
  return parsed > 0 ? parsed : fallback
}

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number.parseFloat(raw.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function normalizeUrl(raw: string | undefined, fallback: string): string {
  const value = (raw || '').trim()
  if (!value) return fallback
  return value.replace(/\/+$/, '')
}

function parseLogLevel(raw: string | undefined, nodeEnv: string): LogLevel {
  const normalized = (raw || '').trim().toLowerCase() as LogLevel
  if (VALID_LOG_LEVELS.includes(normalized)) return normalized
  return nodeEnv === 'test' ? 'silent' : 'info'
}

function parseAllowDevAuth(raw: string | undefined, nodeEnv: string): boolean {
  if (nodeEnv.toLowerCase() === 'production') return false
  const normalized = (raw || '').trim().toLowerCase()
  if (normalized === 'false' || normalized === '0') return false
  if (normalized === 'true' || normalized === '1') return true
  return nodeEnv.toLowerCase() === 'test'
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim() || 'development'
  const webhookSecret =
    env.WEBHOOK_SIGNING_SECRET?.trim() ||
    env.ESP_WEBHOOK_SECRET?.trim() ||
    'test_webhook_secret_tmas'

  const resendApiKey = env.RESEND_API_KEY?.trim() || undefined
  const sqliteDbPath = env.SQLITE_DB_PATH?.trim() || undefined
  const authSecret = env.AUTH_SECRET?.trim() || 'dev_insecure_auth_secret_change_me'
  const bootstrapAdminEmail = env.ADMIN_EMAIL?.trim().toLowerCase() || undefined
  const bootstrapAdminPassword = env.ADMIN_PASSWORD?.trim() || undefined
  const bootstrapAdminName = env.ADMIN_NAME?.trim() || 'Administrator'

  return {
    port: parseNonNegativeInt(env.PORT, 4000, 65535),
    nodeEnv,
    corsOrigin: env.CORS_ORIGIN?.trim() || '*',
    appPublicUrl: normalizeUrl(env.APP_PUBLIC_URL, 'http://localhost:5173'),
    authSecret,
    authTokenTtlSec: parsePositiveInt(env.AUTH_TOKEN_TTL_SEC, 43_200, 2_592_000),
    allowDevAuth: parseAllowDevAuth(env.ALLOW_DEV_AUTH, nodeEnv),
    bootstrapAdminEmail,
    bootstrapAdminPassword,
    bootstrapAdminName,
    webhookSigningSecret: webhookSecret,
    resendApiKey,
    emailFromAddress: env.EMAIL_FROM_ADDRESS?.trim() || 'outreach@example.com',
    sqliteDbPath,
    bodyLimitBytes: parsePositiveInt(env.BODY_LIMIT_BYTES, 1_048_576),
    rateLimitPerSec: parsePositiveNumber(env.RATE_LIMIT_PER_SEC, 8),
    schedulerIntervalMs: parseNonNegativeInt(env.SCHEDULER_INTERVAL_MS, 15_000),
    logLevel: parseLogLevel(env.LOG_LEVEL, nodeEnv),
  }
}

export function getConfig(): ApiConfig {
  return loadConfig(process.env)
}
