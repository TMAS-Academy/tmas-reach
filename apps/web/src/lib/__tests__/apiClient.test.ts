import { describe, it, expect, vi } from 'vitest'
import { ApiClient, ApiClientError } from '../apiClient'

describe('ApiClient resilience, headers, retry, timeout, and health probe', () => {
  it('injects role, user ID, and bearer token headers on requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const client = new ApiClient({
      baseUrl: 'https://api.example.org/',
      fetchImpl: mockFetch,
      getAuthContext: () => ({
        userId: 'usr-2',
        role: 'marketing_lead',
        token: 'secret-token',
      }),
    })

    const data = await client.get<{ ok: boolean }>('/api/contacts')
    expect(data).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.org/api/contacts')
    const headers = init.headers as Record<string, string>
    expect(headers['x-user-role']).toBe('marketing_lead')
    expect(headers['x-user-id']).toBe('usr-2')
    expect(headers.Authorization).toBe('Bearer secret-token')
  })

  it('retries 5xx responses with exponential backoff and succeeds when recovered', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Temporary outage' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [1, 2] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

    const client = new ApiClient({
      baseUrl: 'https://api.example.org',
      maxRetries: 2,
      baseDelayMs: 5,
      fetchImpl: mockFetch,
    })

    const res = await client.get<{ items: number[] }>('/api/items')
    expect(res.items).toEqual([1, 2])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry 4xx client errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    )

    const client = new ApiClient({
      baseUrl: 'https://api.example.org',
      maxRetries: 3,
      baseDelayMs: 5,
      fetchImpl: mockFetch,
    })

    await expect(client.get('/api/admin')).rejects.toThrow(ApiClientError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('aborts hung requests after timeoutMs and surfaces a timeout error', async () => {
    const mockFetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )

    const client = new ApiClient({
      baseUrl: 'https://api.example.org',
      timeoutMs: 25,
      maxRetries: 0,
      fetchImpl: mockFetch,
    })

    await expect(client.get('/api/slow')).rejects.toThrow(/timed out/i)
  })

  it('returns local mode on checkHealth when baseUrl is unset', async () => {
    const mockFetch = vi.fn()
    const client = new ApiClient({
      baseUrl: '',
      fetchImpl: mockFetch,
    })

    const health = await client.checkHealth()
    expect(health.ok).toBe(false)
    expect(health.configured).toBe(false)
    expect(health.mode).toBe('local')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reports connected vs local fallback on checkHealth when configured', async () => {
    const okFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const connectedClient = new ApiClient({
      baseUrl: 'https://api.example.org',
      fetchImpl: okFetch,
    })
    const okHealth = await connectedClient.checkHealth()
    expect(okHealth.ok).toBe(true)
    expect(okHealth.mode).toBe('connected')

    const failingFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const offlineClient = new ApiClient({
      baseUrl: 'https://api.example.org',
      fetchImpl: failingFetch,
    })
    const failHealth = await offlineClient.checkHealth()
    expect(failHealth.ok).toBe(false)
    expect(failHealth.configured).toBe(true)
    expect(failHealth.mode).toBe('local')
  })
})
