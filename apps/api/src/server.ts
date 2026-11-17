import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS'

export interface ApiRequest {
  req: IncomingMessage
  method: string
  path: string
  query: Record<string, string>
  params: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  body: any
  user?: {
    id: string
    email: string
    role: 'marketing_intern' | 'marketing_lead' | 'administrator'
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

  public get(path: string, handler: RouteHandler) {
    this.add('GET', path, handler)
  }

  public post(path: string, handler: RouteHandler) {
    this.add('POST', path, handler)
  }

  public patch(path: string, handler: RouteHandler) {
    this.add('PATCH', path, handler)
  }

  public delete(path: string, handler: RouteHandler) {
    this.add('DELETE', path, handler)
  }

  public match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method === method) {
        const match = pathname.match(route.pattern)
        if (match) {
          const params: Record<string, string> = {}
          route.paramNames.forEach((name, i) => {
            params[name] = decodeURIComponent(match[i + 1])
          })
          return { route, params }
        }
      }
    }
    return null
  }
}

export function createServerApp(router: Router) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role, x-user-id')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    const host = req.headers.host || 'localhost'
    const fullUrl = new URL(req.url || '/', `http://${host}`)
    const pathname = fullUrl.pathname
    const query: Record<string, string> = {}
    fullUrl.searchParams.forEach((value: string, key: string) => {
      query[key] = value
    })

    // Read body
    let rawBody = ''
    try {
      rawBody = await new Promise<string>((resolve, reject) => {
        let chunks = ''
        req.on('data', (c: any) => (chunks += c))
        req.on('end', () => resolve(chunks))
        req.on('error', reject)
      })
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Failed to read request body' }))
      return
    }

    let parsedBody: any = null
    if (rawBody && req.headers['content-type']?.includes('application/json')) {
      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
        return
      }
    } else if (rawBody) {
      parsedBody = rawBody
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

    const match = router.match(req.method || 'GET', pathname)
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
    }

    try {
      await match.route.handler(apiReq, apiRes)
    } catch (err: any) {
      console.error('Unhandled server error:', err)
      if (!res.writableEnded) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }))
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

  return router
}

export function startServer(port = 4000) {
  const router = buildDefaultRouter()
  const app = createServerApp(router)
  const server = http.createServer(app)

  server.listen(port, () => {
    console.log(`TMAS Reach API listening on port ${port}`)
  })

  return server
}
