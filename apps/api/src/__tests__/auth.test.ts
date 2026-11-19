import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  hashPassword,
  signJwt,
  validatePasswordStrength,
  verifyJwt,
  verifyPassword,
} from '../lib/auth.js'
import { loadConfig } from '../lib/config.js'
import { closePersistence, initPersistence, syncPersistence } from '../lib/sqliteStore.js'
import { resetLoginRateLimiter, usersDb } from '../routes/auth.js'
import { activityLogsDb } from '../routes/logs.js'
import { buildDefaultRouter, createManagedServer, createServerApp } from '../server.js'

const activeServers: http.Server[] = []
const tempDirs: string[] = []
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_SECRET: process.env.AUTH_SECRET,
  ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
}

function makeTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmas-reach-auth-'))
  tempDirs.push(dir)
  return path.join(dir, 'auth.sqlite')
}

function listenOnEphemeralPort(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind ephemeral port'))
        return
      }
      resolve(addr.port)
    })
  })
}

async function startTestApp(): Promise<string> {
  const server = http.createServer(createServerApp(buildDefaultRouter()))
  activeServers.push(server)
  const port = await listenOnEphemeralPort(server)
  return `http://127.0.0.1:${port}`
}

beforeEach(() => {
  closePersistence()
  usersDb.length = 0
  activityLogsDb.length = 0
  resetLoginRateLimiter()
  process.env.NODE_ENV = 'test'
  process.env.AUTH_SECRET = 'unit_test_auth_secret_32_bytes_long_!'
  delete process.env.ALLOW_DEV_AUTH
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
})

afterEach(async () => {
  closePersistence()
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('Auth Helpers & Config Rules', () => {
  it('hashes and verifies passwords with scrypt and timing-safe equality', () => {
    const hash = hashPassword('CorrectHorse99!')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('CorrectHorse99!', hash)).toBe(true)
    expect(verifyPassword('WrongPassword99!', hash)).toBe(false)
    expect(verifyPassword('CorrectHorse99!', 'not_a_hash')).toBe(false)
    expect(validatePasswordStrength('short')).toContain('8 characters')
    expect(validatePasswordStrength('ValidPass123!')).toBeNull()
  })

  it('signs, verifies, and rejects expired or tampered HS256 JWTs', () => {
    const secret = 'test_jwt_secret_value_1234567890'
    const now = 1_700_000_000
    const token = signJwt(
      { sub: 'usr_1', email: 'lead@school.edu', role: 'marketing_lead', full_name: 'Lead User' },
      secret,
      300,
      now
    )

    const verified = verifyJwt(token, secret, now + 100)
    expect(verified).not.toBeNull()
    expect(verified?.sub).toBe('usr_1')
    expect(verified?.role).toBe('marketing_lead')

    // Expired
    expect(verifyJwt(token, secret, now + 301)).toBeNull()
    // Wrong secret
    expect(verifyJwt(token, 'wrong_secret', now + 10)).toBeNull()
    // Tampered payload
    const [h, b, s] = token.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: 'usr_1', email: 'lead@school.edu', role: 'administrator', iat: now, exp: now + 300 })
    ).toString('base64url')
    expect(verifyJwt(`${h}.${tamperedPayload}.${s}`, secret, now + 10)).toBeNull()
  })

  it('always disables dev auth headers when NODE_ENV is production', () => {
    const prod = loadConfig({ NODE_ENV: 'production', ALLOW_DEV_AUTH: 'true' })
    expect(prod.allowDevAuth).toBe(false)

    const devDefault = loadConfig({ NODE_ENV: 'development' })
    expect(devDefault.allowDevAuth).toBe(false)

    const devOptIn = loadConfig({ NODE_ENV: 'development', ALLOW_DEV_AUTH: 'true' })
    expect(devOptIn.allowDevAuth).toBe(true)

    const testDefault = loadConfig({ NODE_ENV: 'test' })
    expect(testDefault.allowDevAuth).toBe(true)
  })
})

describe('Auth Endpoints, Production Guard, User Management & Persistence', () => {
  it('bootstraps first admin, locks second bootstrap, logs in, and enforces rate limit', async () => {
    const baseUrl = await startTestApp()

    const statusBefore = await (await fetch(`${baseUrl}/api/auth/status`)).json()
    expect(statusBefore).toEqual({
      initialized: false,
      devAuthAllowed: true,
      authMode: 'jwt',
    })

    const bootRes = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@school.edu',
        full_name: 'Primary Admin',
        password: 'AdminPassword123!',
      }),
    })
    expect(bootRes.status).toBe(201)
    const bootBody = (await bootRes.json()) as { token: string; user: { role: string; email: string } }
    expect(bootBody.user.role).toBe('administrator')
    expect(bootBody.token).toBeTruthy()

    // Second bootstrap blocked
    const secondBoot = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@school.edu',
        full_name: 'Attacker',
        password: 'AdminPassword123!',
      }),
    })
    expect(secondBoot.status).toBe(409)

    // /api/auth/me succeeds with JWT
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${bootBody.token}` },
    })
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as { user: { email: string } }
    expect(meBody.user.email).toBe('admin@school.edu')

    // Change password works
    const chRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bootBody.token}`,
      },
      body: JSON.stringify({
        currentPassword: 'AdminPassword123!',
        newPassword: 'RotatedPassword456!',
      }),
    })
    expect(chRes.status).toBe(200)

    // Old password rejected, new password accepted
    const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@school.edu', password: 'AdminPassword123!' }),
    })
    expect(oldLogin.status).toBe(401)

    const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@school.edu', password: 'RotatedPassword456!' }),
    })
    expect(newLogin.status).toBe(200)

    // Trigger rate limit after 10 failed attempts
    for (let i = 0; i < 10; i++) {
      const fail = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@school.edu', password: 'WrongPassword!' }),
      })
      expect(fail.status).toBe(401)
    }

    const lockedOut = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@school.edu', password: 'RotatedPassword456!' }),
    })
    expect(lockedOut.status).toBe(429)
  })

  it('rejects x-user-role and static dev bearer tokens in production mode', async () => {
    process.env.NODE_ENV = 'production'
    const baseUrl = await startTestApp()

    const boot = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'prod-admin@school.edu',
        full_name: 'Prod Admin',
        password: 'StrongPassword99!',
      }),
    })
    expect(boot.status).toBe(201)
    const { token } = (await boot.json()) as { token: string }

    const headerBypass = await fetch(`${baseUrl}/api/contacts`, {
      headers: { 'x-user-role': 'administrator', 'x-user-id': 'usr_spoof' },
    })
    expect(headerBypass.status).toBe(401)

    const staticTokenBypass = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Authorization: 'Bearer admin-token' },
    })
    expect(staticTokenBypass.status).toBe(401)

    const validJwtRes = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(validJwtRes.status).toBe(200)
  })

  it('manages users, generates temporary passwords, enforces last-admin and self-delete guards, and enforces RBAC', async () => {
    const baseUrl = await startTestApp()

    const boot = await fetch(`${baseUrl}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@school.edu',
        full_name: 'Admin User',
        password: 'Password123!',
      }),
    })
    const { token: adminToken, user: adminUser } = (await boot.json()) as {
      token: string
      user: { id: string }
    }

    // Create intern without explicit password -> returns one-time temporary_password
    const createIntern = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: 'intern@university.edu',
        full_name: 'Campus Intern',
        role: 'marketing_intern',
      }),
    })
    expect(createIntern.status).toBe(201)
    const createdBody = (await createIntern.json()) as {
      user: { id: string; role: string }
      temporary_password: string
    }
    expect(createdBody.temporary_password.length).toBeGreaterThanOrEqual(12)

    // Intern can log in with the temporary password
    const internLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'intern@university.edu',
        password: createdBody.temporary_password,
      }),
    })
    expect(internLogin.status).toBe(200)
    const { token: internToken } = (await internLogin.json()) as { token: string }

    // Intern cannot list users
    const internList = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${internToken}` },
    })
    expect(internList.status).toBe(403)

    // Bulk import creates lead + updates intern
    const importRes = await fetch(`${baseUrl}/api/users/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        rows: [
          { email: 'lead@gmail.com', full_name: 'Lead User', role: 'marketing_lead' },
          { email: 'intern@university.edu', full_name: 'Updated Intern', role: 'marketing_intern' },
        ],
      }),
    })
    expect(importRes.status).toBe(200)
    const importBody = (await importRes.json()) as {
      imported: number
      updated: number
      createdCredentials: Array<{ email: string; temporary_password: string }>
    }
    expect(importBody.imported).toBe(1)
    expect(importBody.updated).toBe(1)
    expect(importBody.createdCredentials).toHaveLength(1)

    // Cannot demote or deactivate or delete the last active administrator
    const demoteLastAdmin = await fetch(`${baseUrl}/api/users/${adminUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'marketing_lead' }),
    })
    expect(demoteLastAdmin.status).toBe(400)

    const selfDelete = await fetch(`${baseUrl}/api/users/${adminUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(selfDelete.status).toBe(400)

    // Deactivating intern invalidates their token immediately
    const deactivate = await fetch(`${baseUrl}/api/users/${createdBody.user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ is_active: false }),
    })
    expect(deactivate.status).toBe(200)

    const internMeAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${internToken}` },
    })
    expect(internMeAfter.status).toBe(401)
  })

  it('persists users across SQLite restarts, migrates legacy columns, and seeds ADMIN_EMAIL', async () => {
    const dbPath = makeTempDbPath()

    // Create a legacy contacts table without district/notes/last_contacted_at to test ensureColumn migration
    const legacy = new DatabaseSync(dbPath)
    legacy.exec(`
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        organization TEXT,
        job_role TEXT,
        audience_tag TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        unsubscribe_token TEXT UNIQUE NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    legacy.close()

    const managed = createManagedServer({
      port: 0,
      enableScheduler: false,
      config: {
        nodeEnv: 'production',
        sqliteDbPath: dbPath,
        authSecret: 'prod_secret_at_least_32_characters_ok',
        bootstrapAdminEmail: 'seeded-admin@school.edu',
        bootstrapAdminPassword: 'SeededPassword123!',
        bootstrapAdminName: 'Seeded Admin',
      },
    })
    const addr = managed.server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    expect(port).toBeGreaterThan(0)

    // Verify seeded admin can sign in over HTTP
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'seeded-admin@school.edu',
        password: 'SeededPassword123!',
      }),
    })
    expect(loginRes.status).toBe(200)
    await managed.shutdown('TEST')

    // Reopen SQLite file and verify usersDb + migrated columns survive
    usersDb.length = 0
    const reopened = initPersistence(dbPath)!
    expect(usersDb).toHaveLength(1)
    expect(usersDb[0].email).toBe('seeded-admin@school.edu')

    const cols = reopened.db.prepare('PRAGMA table_info(contacts);').all() as Array<{ name: string }>
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining(['district', 'notes', 'last_contacted_at'])
    )
    syncPersistence()
  })
})
