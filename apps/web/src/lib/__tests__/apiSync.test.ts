import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../apiClient'
import { AppStore } from '../store'
import type { User } from '../../types'

const ADMIN_USER: User = {
  id: 'usr_admin',
  email: 'admin@school.edu',
  full_name: 'Admin User',
  role: 'administrator',
  is_active: true,
  created_at: '2026-11-19T00:00:00Z',
  updated_at: '2026-11-19T00:00:00Z',
}

describe('AppStore API Sync Mode', () => {
  let appStore: AppStore

  beforeEach(() => {
    localStorage.clear()
    appStore = new AppStore()
  })

  afterEach(() => {
    appStore.dispose()
  })

  it('hydrates all workspace slices from API without overwriting localStorage', async () => {
    localStorage.setItem('tmas_contacts', JSON.stringify([{ id: 'local_only' }]))

    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/contacts')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'cnt_api_1',
                email: 'educator@oak.edu',
                first_name: 'Ada',
                last_name: 'Lovelace',
                organization: 'Oak High',
                district: 'North District',
                status: 'active',
                unsubscribe_token: 'tok_api_1',
                created_at: '2026-11-19T00:00:00Z',
                updated_at: '2026-11-19T00:00:00Z',
              },
            ],
            pagination: { page: 1, totalPages: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/templates')) {
        return new Response(
          JSON.stringify([
            {
              id: 'tmpl_api_1',
              name: 'API Template',
              subject_template: 'Hello {{first_name}}',
              body_text: 'Body {{unsubscribe_url}}',
              created_at: '2026-11-19T00:00:00Z',
              updated_at: '2026-11-19T00:00:00Z',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/campaigns')) {
        return new Response(
          JSON.stringify([
            {
              id: 'cmp_api_1',
              name: 'Spring Outreach',
              template_id: 'tmpl_api_1',
              target_audience_tag: 'high_school',
              status: 'approved',
              scheduled_at: '2026-12-01T12:00:00Z',
              batch_size: 25,
              created_by: 'usr_admin',
              created_at: '2026-11-19T00:00:00Z',
              updated_at: '2026-11-19T00:00:00Z',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/recipients')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/api/surveys')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/api/logs')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'log_1',
                actor_id: 'usr_admin',
                action: 'auth.login',
                entity_type: 'user',
                created_at: '2026-11-19T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/users')) {
        return new Response(JSON.stringify([ADMIN_USER]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('{}', { status: 404 })
    })

    const client = new ApiClient({ baseUrl: 'https://api.example.org', fetchImpl: mockFetch })
    client.setAuthToken('jwt_token')
    appStore.setApiClient(client)
    appStore.setApiMode(true, ADMIN_USER)

    const result = await appStore.hydrateFromApi()
    expect(result.ok).toBe(true)
    expect(appStore.getContacts()).toHaveLength(1)
    expect(appStore.getContacts()[0].email).toBe('educator@oak.edu')
    expect(appStore.getTemplates()[0].body_text).toContain('{{unsubscribe_url}}')
    expect(appStore.getCampaigns()[0].scheduled_for).toBe('2026-12-01T12:00:00Z')
    expect(appStore.getLogs()[0].actor_name).toBe('usr_admin')
    // Local demo cache untouched
    expect(localStorage.getItem('tmas_contacts')).toBe(JSON.stringify([{ id: 'local_only' }]))
  })

  it('sends workspace mutations to API and reconciles on failure', async () => {
    const calledUrls: Array<{ url: string; method: string }> = []
    let failNextPost = false

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'
      calledUrls.push({ url, method })

      if (method === 'POST' && failNextPost) {
        return new Response(JSON.stringify({ error: 'Duplicate contact on server' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url.includes('/api/contacts') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'cnt_srv_1' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/api/contacts')) {
        return new Response(JSON.stringify({ items: [], pagination: { page: 1, totalPages: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/api/campaigns/') && url.endsWith('/test-send')) {
        return new Response(
          JSON.stringify({
            success: true,
            to: 'admin@school.edu',
            messageId: 're_test_123',
            providerMode: 'resend',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/logs')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new ApiClient({
      baseUrl: 'https://api.example.org',
      fetchImpl: mockFetch,
      maxRetries: 0,
    })
    client.setAuthToken('jwt_token')
    appStore.setApiClient(client)
    appStore.setApiMode(true, ADMIN_USER)

    const errorSpy = vi.fn()
    appStore.subscribeStorageError(errorSpy)

    appStore.addContact({ email: 'new@oak.edu', first_name: 'New', status: 'active' })
    await vi.waitFor(() => {
      expect(calledUrls.some((c) => c.url.endsWith('/api/contacts') && c.method === 'POST')).toBe(
        true
      )
    })

    const testRes = await appStore.sendTestEmail('cmp_1', 'admin@school.edu')
    expect(testRes.success).toBe(true)
    expect(testRes.providerMode).toBe('resend')

    // Server error emits storageError toast & triggers hydration rollback
    failNextPost = true
    appStore.addContact({ email: 'conflict@oak.edu', first_name: 'Dup', status: 'active' })
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Duplicate contact on server')
    })
    expect(appStore.getContacts()).toHaveLength(0)
  })

  it('keeps Local mode synchronous and offline when apiMode is false', async () => {
    expect(appStore.isApiMode()).toBe(false)
    const addRes = appStore.addContact({
      email: 'offline@school.edu',
      first_name: 'Offline',
      status: 'active',
    })
    expect(addRes.success).toBe(true)
    expect(appStore.getContacts().some((c) => c.email === 'offline@school.edu')).toBe(true)

    const testRes = await appStore.sendTestEmail('cmp_local')
    expect(testRes.providerMode).toBe('local')
  })
})
