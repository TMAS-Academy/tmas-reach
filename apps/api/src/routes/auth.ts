import crypto from 'node:crypto'
import type { ApiRequest, ApiResponse, Router } from '../server.js'
import { getConfig, type ApiConfig } from '../lib/config.js'
import {
  LoginRateLimiter,
  generateTemporaryPassword,
  hashPassword,
  signJwt,
  validatePasswordStrength,
  verifyPassword,
} from '../lib/auth.js'
import { requireAuth, requireMinimumRole, type UserRole } from '../middleware/rbac.js'
import { appendActivityLog } from './logs.js'

export interface UserRecord {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  password_hash: string
  created_at: string
  updated_at: string
}

export type PublicUser = Omit<UserRecord, 'password_hash'>

const VALID_ROLES = new Set<UserRole>(['marketing_intern', 'marketing_lead', 'administrator'])
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const usersDb: UserRecord[] = []

const loginRateLimiter = new LoginRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 })

export function resetLoginRateLimiter(): void {
  loginRateLimiter.clear()
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

function countOtherActiveAdmins(excludeId: string): number {
  return usersDb.filter(
    (u) => u.id !== excludeId && u.role === 'administrator' && u.is_active
  ).length
}

function getClientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (raw) {
    const first = raw.split(',')[0]?.trim()
    if (first) return first
  }
  return req.req?.socket?.remoteAddress || 'unknown'
}

export function seedBootstrapAdminFromConfig(config: ApiConfig = getConfig()): boolean {
  if (usersDb.length > 0) return false
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) return false
  if (!EMAIL_REGEX.test(config.bootstrapAdminEmail)) return false
  if (validatePasswordStrength(config.bootstrapAdminPassword) !== null) return false

  const now = new Date().toISOString()
  usersDb.push({
    id: `usr_${crypto.randomUUID()}`,
    email: config.bootstrapAdminEmail.toLowerCase(),
    full_name: config.bootstrapAdminName || 'Administrator',
    role: 'administrator',
    is_active: true,
    password_hash: hashPassword(config.bootstrapAdminPassword),
    created_at: now,
    updated_at: now,
  })
  return true
}

export function registerAuthRoutes(router: Router) {
  // GET /api/auth/status — Public initialization status check
  router.get('/api/auth/status', (_req: ApiRequest, res: ApiResponse) => {
    const config = getConfig()
    res.status(200).json({
      initialized: usersDb.length > 0,
      devAuthAllowed: config.allowDevAuth,
      authMode: 'jwt',
    })
  })

  // POST /api/auth/bootstrap — Create first administrator account when usersDb is empty
  router.post('/api/auth/bootstrap', (req: ApiRequest, res: ApiResponse) => {
    if (usersDb.length > 0) {
      res.status(409).json({
        error: 'Workspace already initialized. Sign in with an existing administrator account.',
      })
      return
    }

    const { email, full_name, password } = req.body || {}
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      res.status(400).json({ error: 'A valid email address is required.' })
      return
    }

    const passwordErr = validatePasswordStrength(password)
    if (passwordErr) {
      res.status(400).json({ error: passwordErr })
      return
    }

    const normEmail = email.trim().toLowerCase()
    const displayName =
      typeof full_name === 'string' && full_name.trim()
        ? full_name.trim()
        : normEmail.split('@')[0]

    const now = new Date().toISOString()
    const adminUser: UserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      email: normEmail,
      full_name: displayName,
      role: 'administrator',
      is_active: true,
      password_hash: hashPassword(password),
      created_at: now,
      updated_at: now,
    }

    usersDb.push(adminUser)
    appendActivityLog({
      actor_id: adminUser.id,
      action: 'auth.bootstrap',
      entity_type: 'user',
      entity_id: adminUser.id,
      metadata: { email: adminUser.email },
    })

    const config = getConfig()
    const token = signJwt(
      {
        sub: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        full_name: adminUser.full_name,
      },
      config.authSecret,
      config.authTokenTtlSec
    )

    res.status(201).json({
      token,
      user: toPublicUser(adminUser),
    })
  })

  // POST /api/auth/login — Sign in with email and password
  router.post('/api/auth/login', (req: ApiRequest, res: ApiResponse) => {
    const { email, password } = req.body || {}
    if (
      !email ||
      typeof email !== 'string' ||
      !password ||
      typeof password !== 'string'
    ) {
      res.status(400).json({ error: 'Email and password are required.' })
      return
    }

    const normEmail = email.trim().toLowerCase()
    const rateKey = `${getClientIp(req)}:${normEmail}`
    const limit = loginRateLimiter.check(rateKey)
    if (!limit.allowed) {
      res.status(429).json({
        error: 'Too many failed login attempts. Please try again later.',
        retryAfterSec: limit.retryAfterSec,
      })
      return
    }

    const user = usersDb.find((u) => u.email.toLowerCase() === normEmail)
    if (!user || !verifyPassword(password, user.password_hash)) {
      loginRateLimiter.recordFailure(rateKey)
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'This account has been deactivated.' })
      return
    }

    loginRateLimiter.reset(rateKey)
    appendActivityLog({
      actor_id: user.id,
      action: 'auth.login',
      entity_type: 'user',
      entity_id: user.id,
      metadata: { email: user.email, role: user.role },
    })

    const config = getConfig()
    const token = signJwt(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      config.authSecret,
      config.authTokenTtlSec
    )

    res.status(200).json({
      token,
      user: toPublicUser(user),
    })
  })

  // GET /api/auth/me — Verify current token and return live user profile
  router.get('/api/auth/me', (req: ApiRequest, res: ApiResponse) => {
    const authUser = requireAuth(req, res)
    if (!authUser) return

    const dbUser = usersDb.find((u) => u.id === authUser.id)
    if (dbUser) {
      res.status(200).json({ user: toPublicUser(dbUser) })
      return
    }

    const now = new Date().toISOString()
    res.status(200).json({
      user: {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.full_name || authUser.email,
        role: authUser.role,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    })
  })

  // POST /api/auth/change-password — Update current user's password
  router.post('/api/auth/change-password', (req: ApiRequest, res: ApiResponse) => {
    const authUser = requireAuth(req, res)
    if (!authUser) return

    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || typeof currentPassword !== 'string') {
      res.status(400).json({ error: 'Current password is required.' })
      return
    }

    const strengthErr = validatePasswordStrength(newPassword)
    if (strengthErr) {
      res.status(400).json({ error: strengthErr })
      return
    }

    const dbUser = usersDb.find((u) => u.id === authUser.id)
    if (!dbUser) {
      res.status(404).json({ error: 'User account not found.' })
      return
    }

    if (!verifyPassword(currentPassword, dbUser.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' })
      return
    }

    dbUser.password_hash = hashPassword(newPassword)
    dbUser.updated_at = new Date().toISOString()

    appendActivityLog({
      actor_id: dbUser.id,
      action: 'auth.password_changed',
      entity_type: 'user',
      entity_id: dbUser.id,
      metadata: { email: dbUser.email },
    })

    res.status(200).json({ success: true })
  })

  // GET /api/users — List all users (Administrator only)
  router.get('/api/users', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    res.status(200).json(usersDb.map(toPublicUser))
  })

  // POST /api/users — Create a team member (Administrator only)
  router.post('/api/users', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    const { email, full_name, role = 'marketing_intern', password } = req.body || {}
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      res.status(400).json({ error: 'A valid email address is required.' })
      return
    }

    if (typeof role !== 'string' || !VALID_ROLES.has(role as UserRole)) {
      res.status(400).json({ error: 'Invalid user role.' })
      return
    }

    const normEmail = email.trim().toLowerCase()
    if (usersDb.some((u) => u.email.toLowerCase() === normEmail)) {
      res.status(409).json({ error: `A team member with email "${normEmail}" already exists.` })
      return
    }

    let rawPassword: string
    let generatedTemp: string | undefined
    if (password !== undefined && password !== null && password !== '') {
      const strengthErr = validatePasswordStrength(password)
      if (strengthErr) {
        res.status(400).json({ error: strengthErr })
        return
      }
      rawPassword = password
    } else {
      generatedTemp = generateTemporaryPassword()
      rawPassword = generatedTemp
    }

    const now = new Date().toISOString()
    const newUser: UserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      email: normEmail,
      full_name:
        typeof full_name === 'string' && full_name.trim()
          ? full_name.trim()
          : normEmail.split('@')[0],
      role: role as UserRole,
      is_active: true,
      password_hash: hashPassword(rawPassword),
      created_at: now,
      updated_at: now,
    }

    usersDb.push(newUser)
    appendActivityLog({
      actor_id: actor.id,
      action: 'user.created',
      entity_type: 'user',
      entity_id: newUser.id,
      metadata: { email: newUser.email, role: newUser.role },
    })

    res.status(201).json({
      user: toPublicUser(newUser),
      ...(generatedTemp ? { temporary_password: generatedTemp } : {}),
    })
  })

  // POST /api/users/import — Bulk import/update team members (Administrator only)
  router.post('/api/users/import', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    const { rows } = req.body || {}
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array with at least one member is required.' })
      return
    }

    // Validate rows and ensure batch does not demote all administrators
    const projectedAdminState = new Map<string, boolean>()
    for (const u of usersDb) {
      projectedAdminState.set(u.id, u.role === 'administrator' && u.is_active)
    }

    const normalizedRows: Array<{
      email: string
      full_name: string
      role: UserRole
      password?: string
    }> = []

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const rawEmail = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
      if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) continue

      const nextRole: UserRole =
        typeof row.role === 'string' && VALID_ROLES.has(row.role as UserRole)
          ? (row.role as UserRole)
          : 'marketing_intern'

      const existing = usersDb.find((u) => u.email.toLowerCase() === rawEmail)
      if (existing) {
        projectedAdminState.set(existing.id, nextRole === 'administrator' && existing.is_active)
      } else {
        projectedAdminState.set(`new:${rawEmail}`, nextRole === 'administrator')
      }

      if (row.password !== undefined && row.password !== '') {
        const strengthErr = validatePasswordStrength(row.password)
        if (strengthErr) {
          res.status(400).json({ error: `Invalid password for ${rawEmail}: ${strengthErr}` })
          return
        }
      }

      normalizedRows.push({
        email: rawEmail,
        full_name:
          typeof row.full_name === 'string' && row.full_name.trim()
            ? row.full_name.trim()
            : rawEmail.split('@')[0],
        role: nextRole,
        password: typeof row.password === 'string' && row.password ? row.password : undefined,
      })
    }

    if (normalizedRows.length === 0) {
      res.status(400).json({ error: 'No valid team rows found to import.' })
      return
    }

    const remainingAdmins = Array.from(projectedAdminState.values()).filter(Boolean).length
    if (remainingAdmins === 0) {
      res.status(400).json({ error: 'Import would leave the workspace with zero active administrators.' })
      return
    }

    let imported = 0
    let updated = 0
    const createdCredentials: Array<{
      email: string
      full_name: string
      role: UserRole
      temporary_password: string
    }> = []

    const now = new Date().toISOString()

    for (const row of normalizedRows) {
      const existing = usersDb.find((u) => u.email.toLowerCase() === row.email)
      if (existing) {
        if (row.full_name) existing.full_name = row.full_name
        existing.role = row.role
        if (row.password) {
          existing.password_hash = hashPassword(row.password)
        }
        existing.updated_at = now
        updated++
      } else {
        const tempPassword = row.password ?? generateTemporaryPassword()
        usersDb.push({
          id: `usr_${crypto.randomUUID()}`,
          email: row.email,
          full_name: row.full_name,
          role: row.role,
          is_active: true,
          password_hash: hashPassword(tempPassword),
          created_at: now,
          updated_at: now,
        })
        imported++
        if (!row.password) {
          createdCredentials.push({
            email: row.email,
            full_name: row.full_name,
            role: row.role,
            temporary_password: tempPassword,
          })
        }
      }
    }

    appendActivityLog({
      actor_id: actor.id,
      action: 'users.imported',
      entity_type: 'user',
      metadata: { imported, updated },
    })

    res.status(200).json({
      imported,
      updated,
      users: usersDb.map(toPublicUser),
      createdCredentials,
    })
  })

  // PATCH /api/users/:id — Update user role, name, active status, or password (Administrator only)
  router.patch('/api/users/:id', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    const target = usersDb.find((u) => u.id === req.params.id)
    if (!target) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    const { role, full_name, is_active, password } = req.body || {}

    if (role !== undefined) {
      if (typeof role !== 'string' || !VALID_ROLES.has(role as UserRole)) {
        res.status(400).json({ error: 'Invalid user role.' })
        return
      }
    }

    if (password !== undefined && password !== '') {
      const strengthErr = validatePasswordStrength(password)
      if (strengthErr) {
        res.status(400).json({ error: strengthErr })
        return
      }
    }

    const nextRole = (role as UserRole | undefined) ?? target.role
    const nextActive = typeof is_active === 'boolean' ? is_active : target.is_active

    if (
      target.role === 'administrator' &&
      target.is_active &&
      (nextRole !== 'administrator' || !nextActive) &&
      countOtherActiveAdmins(target.id) === 0
    ) {
      res.status(400).json({ error: 'Cannot demote or deactivate the last active administrator.' })
      return
    }

    target.role = nextRole
    target.is_active = nextActive
    if (typeof full_name === 'string' && full_name.trim()) {
      target.full_name = full_name.trim()
    }
    if (typeof password === 'string' && password) {
      target.password_hash = hashPassword(password)
    }
    target.updated_at = new Date().toISOString()

    appendActivityLog({
      actor_id: actor.id,
      action: 'user.updated',
      entity_type: 'user',
      entity_id: target.id,
      metadata: { role: target.role, is_active: target.is_active },
    })

    res.status(200).json({ user: toPublicUser(target) })
  })

  // DELETE /api/users/:id — Remove a user account (Administrator only)
  router.delete('/api/users/:id', (req: ApiRequest, res: ApiResponse) => {
    const actor = requireMinimumRole('administrator')(req, res)
    if (!actor) return

    const idx = usersDb.findIndex((u) => u.id === req.params.id)
    if (idx === -1) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    const target = usersDb[idx]
    if (target.id === actor.id) {
      res.status(400).json({ error: 'You cannot remove your own administrator account.' })
      return
    }

    if (target.role === 'administrator' && target.is_active && countOtherActiveAdmins(target.id) === 0) {
      res.status(400).json({ error: 'Cannot remove the last active administrator.' })
      return
    }

    usersDb.splice(idx, 1)
    appendActivityLog({
      actor_id: actor.id,
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: target.id,
      metadata: { email: target.email },
    })

    res.status(200).json({ deleted: true, id: target.id })
  })
}
