import type { UserRole } from '../types'

export interface ApiClientConfig {
  baseUrl?: string
  timeoutMs?: number
  maxRetries?: number
  baseDelayMs?: number
  fetchImpl?: typeof fetch
  getAuthContext?: () => { userId?: string; role?: UserRole; token?: string }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
  maxRetries?: number
  signal?: AbortSignal
  skipAuth?: boolean
}

export interface HealthCheckResult {
  ok: boolean
  mode: 'connected' | 'local'
  configured: boolean
  latencyMs?: number
  status?: number
  error?: string
}

export class ApiClientError extends Error {
  public readonly status?: number
  public readonly retryable: boolean
  public readonly details?: unknown

  constructor(message: string, options: { status?: number; retryable?: boolean; details?: unknown } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status
    this.retryable = Boolean(options.retryable)
    this.details = options.details
  }
}

function resolveEnvBaseUrl(): string {
  const raw = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? ''
  return raw.trim().replace(/\/+$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly defaultTimeoutMs: number
  private readonly defaultMaxRetries: number
  private readonly baseDelayMs: number
  private readonly fetchImpl: typeof fetch
  private readonly getAuthContext?: () => { userId?: string; role?: UserRole; token?: string }
  private authToken: string | null = null
  private readonly unauthorizedListeners = new Set<() => void>()

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? resolveEnvBaseUrl()).trim().replace(/\/+$/, '')
    this.defaultTimeoutMs = config.timeoutMs ?? 8000
    this.defaultMaxRetries = config.maxRetries ?? 2
    this.baseDelayMs = config.baseDelayMs ?? 250
    this.fetchImpl = config.fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
    this.getAuthContext = config.getAuthContext
  }

  public setAuthToken(token: string | null) {
    const trimmed = token?.trim() || null
    this.authToken = trimmed
  }

  public getAuthToken(): string | null {
    return this.authToken
  }

  public onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener)
    return () => {
      this.unauthorizedListeners.delete(listener)
    }
  }

  public isConfigured(): boolean {
    return this.baseUrl.length > 0
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new ApiClientError('API base URL is not configured. Running in local storage mode.', {
        retryable: false,
      })
    }

    const method = options.method ?? 'GET'
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = `${this.baseUrl}${normalizedPath}`

    const auth = !options.skipAuth && !this.authToken ? this.getAuthContext?.() : undefined
    const sentBearer = !options.skipAuth && Boolean(this.authToken || auth?.token)
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth?.role ? { 'x-user-role': auth.role } : {}),
      ...(auth?.userId ? { 'x-user-id': auth.userId } : {}),
      ...(!options.skipAuth && this.authToken
        ? { Authorization: `Bearer ${this.authToken}` }
        : auth?.token
          ? { Authorization: `Bearer ${auth.token}` }
          : {}),
      ...options.headers,
    }

    let lastError: ApiClientError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new ApiClientError('Request aborted by caller.', { retryable: false })
      }

      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)

      const onCallerAbort = () => controller.abort()
      options.signal?.addEventListener('abort', onCallerAbort, { once: true })

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onCallerAbort)

        if (response.ok) {
          if (response.status === 204) {
            return undefined as T
          }
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            return (await response.json()) as T
          }
          return (await response.text()) as unknown as T
        }

        const retryable = response.status >= 500 || response.status === 429
        let errorPayload: unknown
        try {
          errorPayload = await response.json()
        } catch {
          try {
            errorPayload = await response.text()
          } catch {
            errorPayload = undefined
          }
        }

        const message =
          typeof errorPayload === 'object' &&
          errorPayload !== null &&
          'error' in errorPayload &&
          typeof (errorPayload as { error?: unknown }).error === 'string'
            ? (errorPayload as { error: string }).error
            : `API request failed with status ${response.status}`

        lastError = new ApiClientError(message, {
          status: response.status,
          retryable,
          details: errorPayload,
        })

        if (response.status === 401 && sentBearer && normalizedPath !== '/api/auth/change-password') {
          this.unauthorizedListeners.forEach((listener) => {
            try {
              listener()
            } catch {
              // Ignore listener errors
            }
          })
        }

        if (!retryable || attempt === maxRetries) {
          throw lastError
        }
      } catch (err) {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onCallerAbort)

        if (err instanceof ApiClientError) {
          lastError = err
          if (!err.retryable || attempt === maxRetries) {
            throw err
          }
        } else if (options.signal?.aborted) {
          throw new ApiClientError('Request aborted by caller.', { retryable: false })
        } else {
          const message = timedOut
            ? `Request timed out after ${timeoutMs}ms`
            : err instanceof Error
              ? err.message
              : 'Network error while contacting API'
          lastError = new ApiClientError(message, { retryable: true })
          if (attempt === maxRetries) {
            throw lastError
          }
        }
      }

      const backoffMs = this.baseDelayMs * Math.pow(2, attempt)
      await sleep(backoffMs)
    }

    throw lastError ?? new ApiClientError('Unknown API error')
  }

  public get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  public post<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  public patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body })
  }

  public delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }

  public async checkHealth(timeoutMs = 3000): Promise<HealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        mode: 'local',
        configured: false,
      }
    }

    const start = Date.now()
    try {
      await this.get<unknown>('/api/health', { timeoutMs, maxRetries: 0 })
      return {
        ok: true,
        mode: 'connected',
        configured: true,
        status: 200,
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      const apiErr = err instanceof ApiClientError ? err : null
      return {
        ok: false,
        mode: 'local',
        configured: true,
        status: apiErr?.status,
        latencyMs: Date.now() - start,
        error: apiErr?.message ?? 'API unreachable',
      }
    }
  }
}

export const apiClient = new ApiClient()
