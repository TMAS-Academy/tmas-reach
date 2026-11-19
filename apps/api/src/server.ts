import crypto from 'node:crypto'
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { pathToFileURL, URL } from 'node:url'
import { getConfig, type ApiConfig } from './lib/config.js'
import { createLogger, type Logger } from './lib/logger.js'
import { closePersistence, initPersistence, syncPersistence } from './lib/sqliteStore.js'
import { registerContactRoutes } from './routes/contacts.js'
import { registerCampaignRoutes } from './routes/campaigns.js'
import { registerLogRoutes } from './routes/logs.js'
import { registerSurveyRoutes } from './routes/surveys.js'
import { registerUnsubscribeRoutes } from './routes/unsubscribe.js'
import { registerWebhookRoutes } from './routes/webhooks.js'
import { registerAuthRoutes, seedBootstrapAdminFromConfig } from './routes/auth.js'
import { registerSystemRoutes } from './routes/system.js'
import { startBatchSchedulerLoop, stopBatchSchedulerLoop } from './services/batchScheduler.js'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS'

export interface ApiRequest {
  req: IncomingMessage
  method: string
  path: string
  query: Record<string, string>
  params: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  body: any
  rawBody?: Buffer
  rawBodyText?: string
  requestId?: string
  user?: {
    id: string
    email: string
    role: 'marketing_intern' | 'marketing_lead' | 'administrator'
    full_name?: string
  }
}

export interface ApiResponse {
  status: (code: number) => ApiResponse
  json: (data: any) => void
  text: (data: string) => void
  send: (data: any) => void
}

export type RouteHandler = (
  req: ApiRequest,
  res: ApiResponse
) => Promise<void | unknown> | void | unknown

export interface Route {
  method: HttpMethod
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

export class BadRequestError extends Error {
  public readonly statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

class PayloadTooLargeError extends Error {
  public readonly statusCode = 413
  constructor(limitBytes: number) {
    super(`Request body exceeds limit of ${limitBytes} bytes`)
    this.name = 'PayloadTooLargeError'
  }
}

export class Router {
  private routes: Route[] = []

  public add(method: HttpMethod, pathPattern: string, handler: RouteHandler) {
    const paramNames: string[] = []
    const regexPattern = pathPattern.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName)
      return '([^/]+)'
    })

    this.routes.push({
      method,
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames,
      handler,
    })
  }

  public get(pathPattern: string, handler: RouteHandler) {
    this.add('GET', pathPattern, handler)
  }

  public post(pathPattern: string, handler: RouteHandler) {
    this.add('POST', pathPattern, handler)
  }

  public patch(pathPattern: string, handler: RouteHandler) {
    this.add('PATCH', pathPattern, handler)
  }

  public delete(pathPattern: string, handler: RouteHandler) {
    this.add('DELETE', pathPattern, handler)
  }

  public match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method === method) {
        const match = pathname.match(route.pattern)
        if (match) {
          const params: Record<string, string> = {}
          for (let i = 0; i < route.paramNames.length; i++) {
            const name = route.paramNames[i]
            try {
              params[name] = decodeURIComponent(match[i + 1])
            } catch {
              throw new BadRequestError(`Malformed URI component for parameter "${name}"`)
            }
          }
          return { route, params }
        }
      }
    }
    return null
  }
}

export interface ServerAppOptions {
  config?: Partial<ApiConfig>
  logger?: Logger
  isShuttingDown?: () => boolean
}

function resolveCorsOrigin(corsOriginConfig: string, requestOrigin?: string): string | null {
  if (corsOriginConfig === '*') return '*'
  const allowed = corsOriginConfig
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (allowed.length === 0) return null
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin
  if (!requestOrigin && allowed.length === 1) return allowed[0]
  return null
}

function resolveRequestId(headerValue: string | string[] | undefined): string {
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue
  const trimmed = candidate?.trim()
  if (trimmed && trimmed.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    return trimmed
  }
  return crypto.randomUUID()
}

function readRequestBody(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let exceeded = false

    const onData = (chunk: Buffer | string) => {
      if (exceeded) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buf.length
      if (totalBytes > limitBytes) {
        exceeded = true
        req.removeListener('data', onData)
        req.removeListener('end', onEnd)
        // Drain remaining bytes so the client reliably receives the 413 response
        req.resume()
        reject(new PayloadTooLargeError(limitBytes))
        return
      }
      chunks.push(buf)
    }

    const onEnd = () => {
      if (!exceeded) resolve(Buffer.concat(chunks, totalBytes))
    }

    const onError = (err: Error) => {
      if (!exceeded) reject(err)
    }

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
  })
}

export function createServerApp(router: Router, options: ServerAppOptions = {}) {
  const baseConfig = getConfig()
  const effectiveConfig: ApiConfig = { ...baseConfig, ...options.config }
  const logger = options.logger ?? createLogger({ level: effectiveConfig.logLevel })

  return async (req: IncomingMessage, res: ServerResponse) => {
    const startNs = process.hrtime.bigint()
    const requestId = resolveRequestId(req.headers['x-request-id'])

    res.setHeader('X-Request-Id', requestId)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')

    const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
    const allowedOrigin = resolveCorsOrigin(effectiveConfig.corsOrigin, reqOrigin)
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      if (allowedOrigin !== '*') {
        res.setHeader('Vary', 'Origin')
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-user-role, x-user-id, x-user-email, x-request-id'
    )
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id')

    let pathname = req.url || '/'
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000
      logger.info('http_request', {
        requestId,
        method: req.method || 'GET',
        path: pathname,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      })
    })

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    let fullUrl: URL
    try {
      const host = req.headers.host || 'localhost'
      fullUrl = new URL(req.url || '/', `http://${host}`)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid request URL' }))
      return
    }

    pathname = fullUrl.pathname
    const query: Record<string, string> = {}
    fullUrl.searchParams.forEach((value: string, key: string) => {
      query[key] = value
    })

    if (req.method === 'GET' && pathname === '/api/ready') {
      const shuttingDown = options.isShuttingDown?.() ?? false
      res.statusCode = shuttingDown ? 503 : 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          status: shuttingDown ? 'shutting_down' : 'ready',
          service: 'tmas-reach-api',
          uptimeSec: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        })
      )
      return
    }

    let rawBody: Buffer
    try {
      rawBody = await readRequestBody(req, effectiveConfig.bodyLimitBytes)
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Payload too large', limitBytes: effectiveConfig.bodyLimitBytes }))
        return
      }
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Failed to read request body' }))
      return
    }

    const rawBodyText = rawBody.toString('utf8')
    let parsedBody: any = null
    if (rawBodyText && req.headers['content-type']?.includes('application/json')) {
      try {
        parsedBody = JSON.parse(rawBodyText)
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
        return
      }
    } else if (rawBodyText) {
      parsedBody = rawBodyText
    }

    const apiRes: ApiResponse = {
      status(code: number) {
        res.statusCode = code
        return apiRes
      },
      json(data: any) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      },
      text(data: string) {
        res.setHeader('Content-Type', 'text/plain')
        res.end(data)
      },
      send(data: any) {
        if (typeof data === 'string') {
          apiRes.text(data)
        } else {
          apiRes.json(data)
        }
      },
    }

    let match: { route: Route; params: Record<string, string> } | null
    try {
      match = router.match(req.method || 'GET', pathname)
    } catch (err) {
      if (err instanceof BadRequestError) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err.message }))
        return
      }
      throw err
    }

    if (!match) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `Cannot ${req.method} ${pathname}` }))
      return
    }

    const apiReq: ApiRequest = {
      req,
      method: req.method || 'GET',
      path: pathname,
      query,
      params: match.params,
      headers: req.headers,
      body: parsedBody,
      rawBody,
      rawBodyText,
      requestId,
    }

    try {
      await match.route.handler(apiReq, apiRes)
      if (
        res.statusCode < 500 &&
        (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE')
      ) {
        syncPersistence()
      }
    } catch (err: any) {
      logger.error('unhandled_route_error', {
        requestId,
        method: req.method,
        path: pathname,
        error: err instanceof Error ? err.message : String(err),
      })
      if (!res.writableEnded) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal Server Error', requestId }))
      }
    }
  }
}

export function buildDefaultRouter(): Router {
  const router = new Router()

  router.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'tmas-reach-api',
      timestamp: new Date().toISOString(),
    })
  })

  registerAuthRoutes(router)
  registerContactRoutes(router)
  registerCampaignRoutes(router)
  registerSurveyRoutes(router)
  registerUnsubscribeRoutes(router)
  registerWebhookRoutes(router)
  registerLogRoutes(router)
  registerSystemRoutes(router)

  return router
}

export interface StartServerOptions {
  port?: number
  config?: Partial<ApiConfig>
  logger?: Logger
  router?: Router
  shutdownTimeoutMs?: number
  enableScheduler?: boolean
  onShutdown?: () => Promise<void> | void
}

export interface GracefulShutdownController {
  isShuttingDown: () => boolean
  shutdown: (signal?: string) => Promise<void>
}

export function createGracefulShutdown(
  server: http.Server,
  options: {
    logger?: Logger
    timeoutMs?: number
    onShutdown?: () => Promise<void> | void
  } = {}
): GracefulShutdownController {
  let shuttingDown = false
  let shutdownPromise: Promise<void> | null = null
  const timeoutMs = options.timeoutMs ?? 10_000

  const shutdown = (signal = 'MANUAL'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise
    shuttingDown = true
    options.logger?.info('server_shutdown_started', { signal })

    shutdownPromise = new Promise<void>((resolve) => {
      const failsafe = setTimeout(() => {
        options.logger?.warn('server_shutdown_forced', { signal, timeoutMs })
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections()
        }
        resolve()
      }, timeoutMs)
      failsafe.unref()

      const finish = async () => {
        try {
          await options.onShutdown?.()
        } catch (err) {
          options.logger?.error('server_shutdown_hook_error', {
            error: err instanceof Error ? err.message : String(err),
          })
        } finally {
          clearTimeout(failsafe)
          options.logger?.info('server_shutdown_complete', { signal })
          resolve()
        }
      }

      if (!server.listening) {
        void finish()
        return
      }

      server.close(() => {
        void finish()
      })

      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections()
      }
    })

    return shutdownPromise
  }

  return {
    isShuttingDown: () => shuttingDown,
    shutdown,
  }
}

export interface ManagedServer {
  server: http.Server
  shutdown: (signal?: string) => Promise<void>
  isShuttingDown: () => boolean
}

export function createManagedServer(portOrOptions?: number | StartServerOptions): ManagedServer {
  const opts: StartServerOptions =
    typeof portOrOptions === 'number' ? { port: portOrOptions } : portOrOptions ?? {}

  const config = { ...getConfig(), ...opts.config }
  const listenPort = opts.port ?? config.port
  const logger = opts.logger ?? createLogger({ level: config.logLevel })
  const router = opts.router ?? buildDefaultRouter()

  if (config.sqliteDbPath) {
    initPersistence(config.sqliteDbPath)
    logger.info('sqlite_persistence_initialized', { dbPath: config.sqliteDbPath })
  }

  if (seedBootstrapAdminFromConfig(config)) {
    syncPersistence()
    logger.info('bootstrap_admin_seeded', { email: config.bootstrapAdminEmail })
  }

  const shouldStartScheduler =
    opts.enableScheduler ?? (config.nodeEnv !== 'test' && config.schedulerIntervalMs > 0)
  if (shouldStartScheduler) {
    startBatchSchedulerLoop({ intervalMs: config.schedulerIntervalMs, logger })
    logger.info('batch_scheduler_started', { intervalMs: config.schedulerIntervalMs })
  }

  let shutdownController: GracefulShutdownController | null = null
  const app = createServerApp(router, {
    config,
    logger,
    isShuttingDown: () => shutdownController?.isShuttingDown() ?? false,
  })

  const server = http.createServer(app)
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
  server.requestTimeout = 30_000

  shutdownController = createGracefulShutdown(server, {
    logger,
    timeoutMs: opts.shutdownTimeoutMs,
    onShutdown: async () => {
      await stopBatchSchedulerLoop()
      await opts.onShutdown?.()
      closePersistence()
    },
  })

  server.listen(listenPort, () => {
    const addr = server.address()
    const boundPort = typeof addr === 'object' && addr ? addr.port : listenPort
    logger.info('server_listening', { port: boundPort, env: config.nodeEnv })
  })

  return {
    server,
    shutdown: shutdownController.shutdown,
    isShuttingDown: shutdownController.isShuttingDown,
  }
}

export function startServer(portOrOptions?: number | StartServerOptions): http.Server {
  return createManagedServer(portOrOptions).server
}

function isDirectEntrypoint(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url
  } catch {
    return false
  }
}

if (isDirectEntrypoint()) {
  const config = getConfig()
  const logger = createLogger({ level: config.logLevel })
  const managed = createManagedServer({ config, logger })

  const handleSignal = (signal: NodeJS.Signals) => {
    void managed.shutdown(signal).then(() => {
      process.exit(0)
    })
  }

  process.once('SIGTERM', handleSignal)
  process.once('SIGINT', handleSignal)
}
