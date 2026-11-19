import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../../../lib/apiClient'
import { LoginView } from '../LoginView'

describe('LoginView', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders first-time admin setup, validates password match, and bootstraps account', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'jwt_admin_123',
          user: {
            id: 'usr_1',
            email: 'admin@school.edu',
            full_name: 'Primary Admin',
            role: 'administrator',
            is_active: true,
            created_at: '2026-11-19T00:00:00Z',
            updated_at: '2026-11-19T00:00:00Z',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      )
    )
    const client = new ApiClient({ baseUrl: 'https://api.example.org', fetchImpl: mockFetch })
    const onAuthenticated = vi.fn()

    const { getByText, getByLabelText, getByRole } = render(
      <LoginView
        initialized={false}
        isDark={true}
        onToggleTheme={vi.fn()}
        onAuthenticated={onAuthenticated}
        onOpenUnsubscribe={vi.fn()}
        client={client}
      />
    )

    expect(getByText('Set Up Administrator Account')).toBeTruthy()

    fireEvent.change(getByLabelText(/Full Name/i), { target: { value: 'Primary Admin' } })
    fireEvent.change(getByLabelText(/Email Address/i), {
      target: { value: 'admin@school.edu' },
    })
    fireEvent.change(getByLabelText(/^Password \*/i), {
      target: { value: 'StrongPass123!' },
    })
    fireEvent.change(getByLabelText(/Confirm Password/i), {
      target: { value: 'Mismatch123!' },
    })
    fireEvent.click(getByRole('button', { name: /Create Administrator/i }))

    expect(getByRole('alert').textContent).toContain('Passwords do not match.')
    expect(mockFetch).not.toHaveBeenCalled()

    fireEvent.change(getByLabelText(/Confirm Password/i), {
      target: { value: 'StrongPass123!' },
    })
    fireEvent.click(getByRole('button', { name: /Create Administrator/i }))

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@school.edu', role: 'administrator' }),
        true
      )
    })
    expect(client.getAuthToken()).toBe('jwt_admin_123')
  })

  it('renders sign-in form, displays invalid login error, and supports unsubscribe shortcut', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    )
    const client = new ApiClient({ baseUrl: 'https://api.example.org', fetchImpl: mockFetch })
    const onOpenUnsubscribe = vi.fn()

    const { getByText, getByLabelText, getByRole } = render(
      <LoginView
        initialized={true}
        isDark={true}
        onToggleTheme={vi.fn()}
        onAuthenticated={vi.fn()}
        onOpenUnsubscribe={onOpenUnsubscribe}
        client={client}
      />
    )

    expect(getByText('Sign in to TMAS Reach')).toBeTruthy()
    fireEvent.change(getByLabelText(/Email Address/i), {
      target: { value: 'intern@school.edu' },
    })
    fireEvent.change(getByLabelText(/^Password \*/i), {
      target: { value: 'WrongPassword1!' },
    })
    fireEvent.click(getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(getByRole('alert').textContent).toContain('Invalid email or password.')
    })

    fireEvent.click(getByRole('button', { name: /Open Public Unsubscribe Portal/i }))
    expect(onOpenUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
