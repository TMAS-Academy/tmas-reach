import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogger } from '../lib/logger.js'
import {
  Router,
  buildDefaultRouter,
  createGracefulShutdown,
  createServerApp,
  startServer,
} from '../server.js'

const activeServers: http.Server[] = []

function listenOnEphemeralPort(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to obtain ephemeral port'))
        return
      }
      resolve(addr.port)
    })
  })
}

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
})

describe('Hardened HTTP Server Runtime', () => {
  it('sets security headers, X-Request-Id, and structured JSON request logs', async () => {
    const logLines: string[] = []
    const logger = createLogger({ level: 'info', write: (line) => logLines.push(line) })
    const router = buildDefaultRouter()
    const server = http.createServer(
      createServerApp(router, {
        config: { corsOrigin: 'https://reach.example.org' },
        logger,
      })
    )
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: {
        Origin: 'https://reach.example.org',
        'x-request-id': 'req_test_001',
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBe('req_test_001')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBe('https://reach.example.org')
    expect(res.headers.get('vary')).toBe('Origin')

    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')

    expect(logLines.length).toBeGreaterThanOrEqual(1)
    const parsedLog = JSON.parse(logLines[0])
    expect(parsedLog.msg).toBe('http_request')
    expect(parsedLog.requestId).toBe('req_test_001')
    expect(parsedLog.path).toBe('/api/health')
    expect(parsedLog.status).toBe(200)
    expect(typeof parsedLog.durationMs).toBe('number')
  })

  it('captures rawBody and rawBodyText accurately for downstream handlers', async () => {
    const router = new Router()
    let capturedRaw = ''
    let capturedBufLen = 0

    router.post('/api/echo-raw', (req, res) => {
      capturedRaw = req.rawBodyText ?? ''
      capturedBufLen = req.rawBody?.length ?? 0
      res.status(200).json({ ok: true, parsed: req.body })
    })

    const server = http.createServer(createServerApp(router))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const rawPayload = '{  "hello": "world",  "n": 1 }'
    const res = await fetch(`http://127.0.0.1:${port}/api/echo-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawPayload,
    })

    expect(res.status).toBe(200)
    expect(capturedRaw).toBe(rawPayload)
    expect(capturedBufLen).toBe(Buffer.byteLength(rawPayload))
  })

  it('rejects oversized payloads with 413 Payload Too Large', async () => {
    const router = new Router()
    router.post('/api/upload', (_req, res) => {
      res.status(200).json({ ok: true })
    })

    const server = http.createServer(
      createServerApp(router, {
        config: { bodyLimitBytes: 64 },
      })
    )
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const oversized = JSON.stringify({ data: 'x'.repeat(200) })
    const res = await fetch(`http://127.0.0.1:${port}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversized,
    })

    expect(res.status).toBe(413)
    const body = (await res.json()) as { error: string; limitBytes: number }
    expect(body.error).toBe('Payload too large')
    expect(body.limitBytes).toBe(64)
  })

  it('returns 400 on malformed URI encoding in path parameters', async () => {
    const router = new Router()
    router.get('/api/items/:id', (req, res) => {
      res.status(200).json({ id: req.params.id })
    })

    const server = http.createServer(createServerApp(router))
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const res = await fetch(`http://127.0.0.1:${port}/api/items/%E0%A4%A`)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('Malformed URI component')
  })

  it('serves /api/ready as 200 while active and 503 during shutdown, and configures HTTP timeouts', async () => {
    let shuttingDown = false
    const router = buildDefaultRouter()
    const server = http.createServer(
      createServerApp(router, {
        isShuttingDown: () => shuttingDown,
      })
    )
    activeServers.push(server)
    const port = await listenOnEphemeralPort(server)

    const readyRes = await fetch(`http://127.0.0.1:${port}/api/ready`)
    expect(readyRes.status).toBe(200)
    expect(((await readyRes.json()) as { status: string }).status).toBe('ready')

    shuttingDown = true
    const drainingRes = await fetch(`http://127.0.0.1:${port}/api/ready`)
    expect(drainingRes.status).toBe(503)
    expect(((await drainingRes.json()) as { status: string }).status).toBe('shutting_down')

    // Verify startServer timeout configuration and graceful shutdown hook
    let hookCalled = false
    const managedServer = startServer({ port: 0 })
    activeServers.push(managedServer)
    expect(managedServer.keepAliveTimeout).toBe(65_000)
    expect(managedServer.headersTimeout).toBe(66_000)
    expect(managedServer.requestTimeout).toBe(30_000)

    const controller = createGracefulShutdown(managedServer, {
      onShutdown: () => {
        hookCalled = true
      },
    })
    await controller.shutdown('SIGTERM')
    expect(controller.isShuttingDown()).toBe(true)
    expect(hookCalled).toBe(true)
    expect(managedServer.listening).toBe(false)
  })
})
