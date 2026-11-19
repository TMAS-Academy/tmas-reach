import crypto from 'node:crypto'
import type { UserRole } from '../middleware/rbac.js'

const VALID_ROLES = new Set<UserRole>(['marketing_intern', 'marketing_lead', 'administrator'])

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  full_name?: string
  iat: number
  exp: number
}

export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return 'Password is required.'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (password.length > 256) {
    return 'Password must be 256 characters or fewer.'
  }
  return null
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false
  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const [, saltHex, hashHex] = parts
  if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(hashHex)) {
    return false
  }

  try {
    const expected = Buffer.from(hashHex, 'hex')
    const actual = crypto.scryptSync(password, saltHex, 64)
    if (actual.length !== expected.length) return false
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function signJwt(
  payload: { sub: string; email: string; role: UserRole; full_name?: string },
  secret: string,
  ttlSec = 43_200,
  nowSec = Math.floor(Date.now() / 1000)
): string {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url'
  )
  const fullPayload: JwtPayload = {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    ...(payload.full_name ? { full_name: payload.full_name } : {}),
    iat: nowSec,
    exp: nowSec + ttlSec,
  }
  const bodyB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url')
  const signingInput = `${headerB64}.${bodyB64}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput, 'utf8')
    .digest('base64url')

  return `${signingInput}.${signature}`
}

export function verifyJwt(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000)
): JwtPayload | null {
  if (typeof token !== 'string' || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, bodyB64, sigB64] = parts
  if (!headerB64 || !bodyB64 || !sigB64) return null

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string
      typ?: string
    }
    if (header.alg !== 'HS256') return null

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${bodyB64}`, 'utf8')
      .digest('base64url')

    const actualBuf = Buffer.from(sigB64, 'utf8')
    const expectedBuf = Buffer.from(expectedSig, 'utf8')
    if (actualBuf.length !== expectedBuf.length) return null
    if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null

    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as Partial<JwtPayload>
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      !payload.role ||
      !VALID_ROLES.has(payload.role) ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      return null
    }

    if (payload.exp <= nowSec) return null

    return payload as JwtPayload
  } catch {
    return null
  }
}

export function generateTemporaryPassword(length = 14): string {
  const safeLength = Math.max(12, length)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = crypto.randomBytes(safeLength)
  let out = ''
  for (let i = 0; i < safeLength; i++) {
    out += chars[bytes[i] % chars.length]
  }
  return out
}

export class LoginRateLimiter {
  private readonly maxAttempts: number
  private readonly windowMs: number
  private readonly attempts = new Map<string, number[]>()

  constructor(options: { maxAttempts?: number; windowMs?: number } = {}) {
    this.maxAttempts = options.maxAttempts ?? 10
    this.windowMs = options.windowMs ?? 15 * 60 * 1000
  }

  private prune(key: string, now: number): number[] {
    const cutoff = now - this.windowMs
    const recent = (this.attempts.get(key) ?? []).filter((ts) => ts > cutoff)
    if (recent.length === 0) {
      this.attempts.delete(key)
    } else {
      this.attempts.set(key, recent)
    }
    return recent
  }

  public check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec?: number } {
    const recent = this.prune(key, now)
    if (recent.length < this.maxAttempts) {
      return { allowed: true }
    }
    const oldestInWindow = recent[0]
    const retryAfterMs = Math.max(1000, oldestInWindow + this.windowMs - now)
    return {
      allowed: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    }
  }

  public recordFailure(key: string, now: number = Date.now()): void {
    const recent = this.prune(key, now)
    recent.push(now)
    this.attempts.set(key, recent)
  }

  public reset(key: string): void {
    this.attempts.delete(key)
  }

  public clear(): void {
    this.attempts.clear()
  }
}
