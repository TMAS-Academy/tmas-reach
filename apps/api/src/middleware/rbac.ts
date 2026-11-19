import type { ApiRequest, ApiResponse } from '../server.js'

export type UserRole = 'marketing_intern' | 'marketing_lead' | 'administrator'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  marketing_intern: 1,
  marketing_lead: 2,
  administrator: 3,
}

const VALID_ROLES = new Set<UserRole>(['marketing_intern', 'marketing_lead', 'administrator'])

const BEARER_TOKEN_ROLES: Record<string, UserRole> = {
  'admin-token': 'administrator',
  'lead-token': 'marketing_lead',
  'intern-token': 'marketing_intern',
}

export function extractAuthUser(req: ApiRequest): AuthUser | null {
  const rawRoleHeader = req.headers['x-user-role']
  const roleHeader = Array.isArray(rawRoleHeader) ? rawRoleHeader[0] : rawRoleHeader
  const rawUserIdHeader = req.headers['x-user-id']
  const userIdHeader =
    (Array.isArray(rawUserIdHeader) ? rawUserIdHeader[0] : rawUserIdHeader)?.trim() || 'usr_anonymous'
  const rawAuthHeader = req.headers['authorization']
  const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader

  let role: UserRole | null = null

  if (roleHeader !== undefined) {
    const normalized = roleHeader.trim() as UserRole
    if (!VALID_ROLES.has(normalized)) {
      return null
    }
    role = normalized
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) return null
    role = BEARER_TOKEN_ROLES[token] ?? null
    if (!role) return null
  } else {
    return null
  }

  const rawEmailHeader = req.headers['x-user-email']
  const emailHeader = (Array.isArray(rawEmailHeader) ? rawEmailHeader[0] : rawEmailHeader)?.trim()

  return {
    id: userIdHeader,
    email: emailHeader || `${userIdHeader}@example.com`,
    role,
  }
}

export function requireAuth(req: ApiRequest, res: ApiResponse): AuthUser | null {
  const user = extractAuthUser(req)
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required. Provide a valid Authorization bearer token or x-user-role header.',
    })
    return null
  }
  req.user = user
  return user
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: ApiRequest, res: ApiResponse): AuthUser | null => {
    const user = requireAuth(req, res)
    if (!user) return null

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Role "${user.role}" does not have permission for this resource. Required one of: ${allowedRoles.join(', ')}`,
      })
      return null
    }

    return user
  }
}

export function requireMinimumRole(minRole: UserRole) {
  return (req: ApiRequest, res: ApiResponse): AuthUser | null => {
    const user = requireAuth(req, res)
    if (!user) return null

    if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Action requires at least "${minRole}" role. Current role is "${user.role}".`,
      })
      return null
    }

    return user
  }
}
