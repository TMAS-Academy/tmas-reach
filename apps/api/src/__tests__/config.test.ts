import { describe, it, expect } from 'vitest'
import { loadConfig } from '../lib/config.js'

describe('API Config Loader', () => {
  it('returns safe defaults when env vars are unset', () => {
    const config = loadConfig({})

    expect(config.port).toBe(4000)
    expect(config.nodeEnv).toBe('development')
    expect(config.corsOrigin).toBe('*')
    expect(config.appPublicUrl).toBe('http://localhost:5173')
    expect(config.webhookSigningSecret).toBe('test_webhook_secret_tmas')
    expect(config.resendApiKey).toBeUndefined()
    expect(config.emailFromAddress).toBe('outreach@example.com')
    expect(config.emailFromAddress).not.toContain('tmasacademy.org')
    expect(config.sqliteDbPath).toBeUndefined()
    expect(config.bodyLimitBytes).toBe(1_048_576)
    expect(config.rateLimitPerSec).toBe(8)
    expect(config.schedulerIntervalMs).toBe(15_000)
    expect(config.logLevel).toBe('info')
  })

  it('prefers WEBHOOK_SIGNING_SECRET over legacy ESP_WEBHOOK_SECRET', () => {
    const both = loadConfig({
      WEBHOOK_SIGNING_SECRET: 'primary_secret',
      ESP_WEBHOOK_SECRET: 'legacy_secret',
    })
    expect(both.webhookSigningSecret).toBe('primary_secret')

    const legacyOnly = loadConfig({
      ESP_WEBHOOK_SECRET: 'legacy_secret',
    })
    expect(legacyOnly.webhookSigningSecret).toBe('legacy_secret')
  })

  it('parses custom values and strips trailing slashes from APP_PUBLIC_URL', () => {
    const config = loadConfig({
      PORT: '8080',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://reach.example.org',
      APP_PUBLIC_URL: 'https://reach.example.org///',
      RESEND_API_KEY: 're_live_123',
      EMAIL_FROM_ADDRESS: 'team@example.org',
      SQLITE_DB_PATH: './data/reach.sqlite',
      BODY_LIMIT_BYTES: '524288',
      RATE_LIMIT_PER_SEC: '5.5',
      SCHEDULER_INTERVAL_MS: '30000',
      LOG_LEVEL: 'warn',
    })

    expect(config.port).toBe(8080)
    expect(config.nodeEnv).toBe('production')
    expect(config.corsOrigin).toBe('https://reach.example.org')
    expect(config.appPublicUrl).toBe('https://reach.example.org')
    expect(config.resendApiKey).toBe('re_live_123')
    expect(config.emailFromAddress).toBe('team@example.org')
    expect(config.sqliteDbPath).toBe('./data/reach.sqlite')
    expect(config.bodyLimitBytes).toBe(524288)
    expect(config.rateLimitPerSec).toBe(5.5)
    expect(config.schedulerIntervalMs).toBe(30000)
    expect(config.logLevel).toBe('warn')
  })

  it('falls back to defaults on malformed or out-of-range numeric values', () => {
    const config = loadConfig({
      PORT: '99999',
      BODY_LIMIT_BYTES: '-100',
      RATE_LIMIT_PER_SEC: 'abc',
      SCHEDULER_INTERVAL_MS: '-5',
    })

    expect(config.port).toBe(4000)
    expect(config.bodyLimitBytes).toBe(1_048_576)
    expect(config.rateLimitPerSec).toBe(8)
    expect(config.schedulerIntervalMs).toBe(15_000)
  })

  it('defaults logLevel to silent when NODE_ENV is test', () => {
    const config = loadConfig({ NODE_ENV: 'test' })
    expect(config.logLevel).toBe('silent')
  })
})
