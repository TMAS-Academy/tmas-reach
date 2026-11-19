import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../../lib/apiClient'
import { ReadinessPanel } from '../ReadinessPanel'

describe('ReadinessPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows local mode guidance when API mode is disabled', () => {
    const { getByText } = render(<ReadinessPanel isApiMode={false} />)
    expect(getByText('Production Readiness (Local Demo Mode)')).toBeTruthy()
    expect(getByText(/VITE_API_BASE_URL/i)).toBeTruthy()
  })

  it('loads readiness checks and verifies Resend domain in API mode', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/system/readiness')) {
        return new Response(
          JSON.stringify({
            readyForLiveOutreach: false,
            environment: 'development',
            providerMode: 'mock',
            checks: [
              {
                id: 'auth_secret',
                label: 'JWT signing secret',
                status: 'fail',
                detail: 'Set AUTH_SECRET to at least 32 characters.',
                envVar: 'AUTH_SECRET',
              },
              {
                id: 'admin_account',
                label: 'Active administrator account',
                status: 'pass',
                detail: 'At least one active administrator account exists.',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/api/system/verify-domain')) {
        return new Response(
          JSON.stringify({
            configured: true,
            domain: 'mail.school.org',
            verified: true,
            status: 'verified',
            records: [{ record: 'TXT', name: '_dmarc', type: 'TXT', value: 'v=DMARC1', status: 'verified' }],
            message: 'Domain "mail.school.org" is verified in Resend.',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response('{}', { status: 404 })
    })

    const client = new ApiClient({ baseUrl: 'https://api.example.org', fetchImpl: mockFetch })
    client.setAuthToken('jwt_admin')
    const onToast = vi.fn()

    const { getByText, getByRole } = render(
      <ReadinessPanel isApiMode={true} onToast={onToast} client={client} />
    )

    await waitFor(() => {
      expect(getByText('Action required before live sending')).toBeTruthy()
    })
    expect(getByText('JWT signing secret')).toBeTruthy()
    expect(getByText('sender: Mock')).toBeTruthy()

    fireEvent.click(getByRole('button', { name: /Verify Resend Domain/i }))
    await waitFor(() => {
      expect(getByText('Domain "mail.school.org" is verified in Resend.')).toBeTruthy()
    })
    expect(getByText('_dmarc')).toBeTruthy()
    expect(onToast).toHaveBeenCalledWith(
      'success',
      'Domain "mail.school.org" is verified in Resend.'
    )
  })
})
