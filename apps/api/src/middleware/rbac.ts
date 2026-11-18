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

export function extractAuthUser(req: ApiRequest): AuthUser | null {
  const roleHeader = req.headers['x-user-role'] as string | undefined
  const userIdHeader = (req.headers['x-user-id'] as string | undefined) || 'usr_anonymous'
  const authHeader = req.headers['authorization'] as string | undefined

  let role: UserRole = 'marketing_intern'

  if (roleHeader && (roleHeader === 'marketing_intern' || roleHeader === 'marketing_lead' || roleHeader === 'administrator')) {
    role = roleHeader
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim()
    if (token === 'admin-token') role = 'administrator'
    else if (token === 'lead-token') role = 'marketing_lead'
    else role = 'marketing_intern'
  } else {
    // If no credentials provided, return null (unauthenticated)
    return null
  }

  const emailHeader = (req.headers['x-user-email'] as string | undefined)?.trim()

  return {
    id: userIdHeader,
    email: emailHeader || `${userIdHeader}@example.com`,
    role,
  }
}

export function requireAuth(
  req: ApiRequest,
  res: ApiResponse
): AuthUser | null {
  const user = extractAuthUser(req)
  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required. Provide Authorization bearer token or x-user-role header.',
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
