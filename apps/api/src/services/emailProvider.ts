import crypto from 'node:crypto'
import { getConfig, type ApiConfig } from '../lib/config.js'

export interface EmailSendOptions {
  idempotencyKey?: string
  from?: string
  html?: string
  headers?: Record<string, string>
}

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
  statusCode?: number
  retryable?: boolean
  retryAfterMs?: number
}

export interface EmailSenderClient {
  sendEmail: (
    to: string,
    subject: string,
    body: string,
    options?: EmailSendOptions
  ) => Promise<EmailSendResult>
}

export interface ResendProviderOptions {
  apiKey: string
  fromAddress: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function parseRetryAfterMs(
  headerValue: string | null | undefined,
  nowMs: number = Date.now()
): number | undefined {
  if (!headerValue) return undefined
  const trimmed = headerValue.trim()
  if (!trimmed) return undefined

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number.parseFloat(trimmed)
    return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : undefined
  }

  const parsedDateMs = Date.parse(trimmed)
  if (!Number.isNaN(parsedDateMs)) {
    return Math.max(0, parsedDateMs - nowMs)
  }

  return undefined
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

export function createResendEmailProvider(options: ResendProviderOptions): EmailSenderClient {
  const baseUrl = (options.baseUrl || 'https://api.resend.com').replace(/\/+$/, '')
  const timeoutMs = options.timeoutMs ?? 10_000
  const fetchFn = options.fetchImpl ?? fetch

  return {
    async sendEmail(to, subject, body, sendOptions) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      }

      if (sendOptions?.idempotencyKey) {
        headers['Idempotency-Key'] = sendOptions.idempotencyKey
      }

      const payload: Record<string, unknown> = {
        from: sendOptions?.from || options.fromAddress,
        to: [to],
        subject,
        text: body,
      }

      if (sendOptions?.html) {
        payload.html = sendOptions.html
      }
      if (sendOptions?.headers && Object.keys(sendOptions.headers).length > 0) {
        payload.headers = sendOptions.headers
      }

      try {
        const response = await fetchFn(`${baseUrl}/emails`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        })

        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
        let responseBody: any = null
        try {
          responseBody = await response.json()
        } catch {
          responseBody = null
        }

        if (response.ok) {
          return {
            success: true,
            messageId: typeof responseBody?.id === 'string' ? responseBody.id : undefined,
            statusCode: response.status,
          }
        }

        const errorMsg =
          (typeof responseBody?.message === 'string' && responseBody.message) ||
          (typeof responseBody?.error === 'string' && responseBody.error) ||
          `Resend API error (${response.status})`

        return {
          success: false,
          statusCode: response.status,
          retryable: isRetryableHttpStatus(response.status),
          retryAfterMs,
          error: errorMsg,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          retryable: true,
          error: message,
        }
      }
    },
  }
}

export function createMockEmailProvider(): EmailSenderClient {
  return {
    async sendEmail() {
      return {
        success: true,
        messageId: `msg_${crypto.randomUUID()}`,
        statusCode: 200,
      }
    },
  }
}

export function createEmailProvider(
  config: Pick<ApiConfig, 'resendApiKey' | 'emailFromAddress'> = getConfig(),
  overrides?: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch }
): EmailSenderClient {
  const apiKey = config.resendApiKey?.trim()
  if (apiKey && apiKey !== 'your-resend-api-key') {
    return createResendEmailProvider({
      apiKey,
      fromAddress: config.emailFromAddress,
      baseUrl: overrides?.baseUrl,
      timeoutMs: overrides?.timeoutMs,
      fetchImpl: overrides?.fetchImpl,
    })
  }
  return createMockEmailProvider()
}
