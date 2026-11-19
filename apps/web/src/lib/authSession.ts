import type { User } from '../types'
import { apiClient, type ApiClient } from './apiClient'

const TOKEN_STORAGE_KEY = 'tmas_auth_token'

export interface AuthStatusResponse {
  initialized: boolean
  devAuthAllowed: boolean
  authMode: string
}

export interface AuthSuccessResponse {
  token: string
  user: User
}

export function getStoredToken(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function saveStoredToken(token: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable
  }
}

export async function getAuthStatus(client: ApiClient = apiClient): Promise<AuthStatusResponse> {
  return client.get<AuthStatusResponse>('/api/auth/status', { skipAuth: true, maxRetries: 1 })
}

export async function bootstrapAdmin(
  input: { email: string; full_name: string; password: string },
  client: ApiClient = apiClient
): Promise<User> {
  const res = await client.post<AuthSuccessResponse>('/api/auth/bootstrap', input, {
    skipAuth: true,
    maxRetries: 0,
  })
  saveStoredToken(res.token)
  client.setAuthToken(res.token)
  return res.user
}

export async function loginWithPassword(
  email: string,
  password: string,
  client: ApiClient = apiClient
): Promise<User> {
  const res = await client.post<AuthSuccessResponse>(
    '/api/auth/login',
    { email, password },
    { skipAuth: true, maxRetries: 0 }
  )
  saveStoredToken(res.token)
  client.setAuthToken(res.token)
  return res.user
}

export async function restoreSession(client: ApiClient = apiClient): Promise<User | null> {
  const token = getStoredToken()
  if (!token) {
    client.setAuthToken(null)
    return null
  }

  client.setAuthToken(token)
  try {
    const res = await client.get<{ user: User }>('/api/auth/me', { maxRetries: 0 })
    return res.user
  } catch {
    saveStoredToken(null)
    client.setAuthToken(null)
    return null
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  client: ApiClient = apiClient
): Promise<void> {
  await client.post<{ success: boolean }>(
    '/api/auth/change-password',
    { currentPassword, newPassword },
    { maxRetries: 0 }
  )
}

export function logoutSession(client: ApiClient = apiClient): void {
  saveStoredToken(null)
  client.setAuthToken(null)
}
