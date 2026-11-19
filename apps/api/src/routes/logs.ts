import crypto from 'node:crypto'
import type { ApiRequest, ApiResponse, Router } from '../server.js'
import { requireAuth } from '../middleware/rbac.js'

export interface ActivityLogRecord {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export const activityLogsDb: ActivityLogRecord[] = []

const MAX_IN_MEMORY_LOGS = 2000

export function appendActivityLog(input: {
  actor_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  metadata?: Record<string, unknown>
  created_at?: string
}): ActivityLogRecord {
  const entry: ActivityLogRecord = {
    id: `log_${crypto.randomUUID()}`,
    actor_id: input.actor_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
    created_at: input.created_at ?? new Date().toISOString(),
  }

  activityLogsDb.unshift(entry)
  if (activityLogsDb.length > MAX_IN_MEMORY_LOGS) {
    activityLogsDb.length = MAX_IN_MEMORY_LOGS
  }

  return entry
}

export function registerLogRoutes(router: Router) {
  router.get('/api/logs', (req: ApiRequest, res: ApiResponse) => {
    const user = requireAuth(req, res)
    if (!user) return

    const { action, entity_type, actor_id, page = '1', limit = '50' } = req.query
    let result = [...activityLogsDb]

    if (action) {
      result = result.filter((entry) => entry.action === action)
    }
    if (entity_type) {
      result = result.filter((entry) => entry.entity_type === entity_type)
    }
    if (actor_id) {
      result = result.filter((entry) => entry.actor_id === actor_id)
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50))
    const total = result.length
    const totalPages = Math.ceil(total / limitNum) || 1
    const offset = (pageNum - 1) * limitNum
    const items = result.slice(offset, offset + limitNum)

    res.status(200).json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    })
  })
}
