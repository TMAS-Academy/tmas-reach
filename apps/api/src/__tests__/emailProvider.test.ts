import { describe, expect, it, vi } from 'vitest'
import {
  createEmailProvider,
  createResendEmailProvider,
  parseRetryAfterMs,
} from '../services/emailProvider.js'

describe('Resend Email Provider Adapter', () => {
  it('sends POST /emails with Authorization, Idempotency-Key, and AbortSignal', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init
      return new Response(JSON.stringify({ id: 're_abc123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const provider = createResendEmailProvider({
      apiKey: 're_live_secret',
      fromAddress: 'outreach@example.com',
      fetchImpl: mockFetch,
    })

    const res = await provider.sendEmail('teacher@school.edu', 'Math Event', 'Hello educator', {
      idempotencyKey: 'cmp_1:rcp_1',
    })

    expect(res).toEqual({
      success: true,
      messageId: 're_abc123',
      statusCode: 200,
    })
    expect(capturedUrl).toBe('https://api.resend.com/emails')
    expect(capturedInit?.method).toBe('POST')
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal)

    const headers = capturedInit?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_live_secret')
    expect(headers['Idempotency-Key']).toBe('cmp_1:rcp_1')

    const parsedBody = JSON.parse(String(capturedInit?.body))
    expect(parsedBody).toEqual({
      from: 'outreach@example.com',
      to: ['teacher@school.edu'],
      subject: 'Math Event',
      text: 'Hello educator',
    })
  })

  it('classifies 429 rate-limit responses as retryable and parses Retry-After header', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3',
        },
      })

    const provider = createResendEmailProvider({
      apiKey: 're_live_secret',
      fromAddress: 'outreach@example.com',
      fetchImpl: mockFetch,
    })

    const res = await provider.sendEmail('teacher@school.edu', 'Subject', 'Body')
    expect(res.success).toBe(false)
    expect(res.statusCode).toBe(429)
    expect(res.retryable).toBe(true)
    expect(res.retryAfterMs).toBe(3000)
    expect(res.error).toBe('Too many requests')
  })

  it('classifies 5xx and network errors as retryable, and 4xx validation errors as permanent', async () => {
    const serverErrProvider = createResendEmailProvider({
      apiKey: 're_live_secret',
      fromAddress: 'outreach@example.com',
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: 'Upstream unavailable' }), { status: 503 }),
    })
    const err503 = await serverErrProvider.sendEmail('a@school.edu', 'S', 'B')
    expect(err503.success).toBe(false)
    expect(err503.retryable).toBe(true)
    expect(err503.statusCode).toBe(503)

    const permanentErrProvider = createResendEmailProvider({
      apiKey: 're_live_secret',
      fromAddress: 'outreach@example.com',
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: 'Invalid recipient address' }), { status: 422 }),
    })
    const err422 = await permanentErrProvider.sendEmail('invalid', 'S', 'B')
    expect(err422.success).toBe(false)
    expect(err422.retryable).toBe(false)
    expect(err422.statusCode).toBe(422)

    const networkErrProvider = createResendEmailProvider({
      apiKey: 're_live_secret',
      fromAddress: 'outreach@example.com',
      fetchImpl: async () => {
        throw new Error('ECONNRESET')
      },
    })
    const netErr = await networkErrProvider.sendEmail('a@school.edu', 'S', 'B')
    expect(netErr.success).toBe(false)
    expect(netErr.retryable).toBe(true)
    expect(netErr.error).toBe('ECONNRESET')
  })

  it('parses Retry-After in seconds and HTTP-date format', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0)
    expect(parseRetryAfterMs('5', now)).toBe(5000)
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 12:00:10 GMT', now)).toBe(10_000)
    expect(parseRetryAfterMs('invalid', now)).toBeUndefined()
  })

  it('falls back to mock sender when RESEND_API_KEY is unset or placeholder', async () => {
    const fetchSpy = vi.fn()
    const provider = createEmailProvider(
      { resendApiKey: undefined, emailFromAddress: 'outreach@example.com' },
      { fetchImpl: fetchSpy as unknown as typeof fetch }
    )

    const res = await provider.sendEmail('a@school.edu', 'Hi', 'Body')
    expect(res.success).toBe(true)
    expect(res.messageId).toMatch(/^msg_/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
