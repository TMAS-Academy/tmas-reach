import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashPassword } from '../lib/auth.js'
import { loadConfig } from '../lib/config.js'
import { usersDb } from '../routes/auth.js'
import { campaignsDb, campaignRecipientsDb, templatesDb } from '../routes/campaigns.js'
import { contactsDb } from '../routes/contacts.js'
import { activityLogsDb } from '../routes/logs.js'
import { surveysDb } from '../routes/surveys.js'
import { evaluateReadiness, verifyResendDomain } from '../routes/system.js'
import { buildDefaultRouter, createServerApp } from '../server.js'

const activeServers: http.Server[] = []

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
  usersDb.length = 0
  contactsDb.length = 0
  campaignsDb.length = 0
  campaignRecipientsDb.length = 0
  surveysDb.length = 0
  activityLogsDb.length = 0
})

afterEach(async () => {
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
})

describe('System Readiness & Resend Domain Verification', () => {
  it('flags insecure defaults and passes when production settings and admin exist', () => {
    const devConfig = loadConfig({})
    const devReport = evaluateReadiness(devConfig)
    expect(devReport.readyForLiveOutreach).toBe(false)
    expect(devReport.providerMode).toBe('mock')
    expect(devReport.checks.some((c) => c.id === 'auth_secret' && c.status === 'fail')).toBe(true)
    expect(devReport.checks.some((c) => c.id === 'admin_account' && c.status === 'fail')).toBe(true)

    const now = new Date().toISOString()
    usersDb.push({
      id: 'usr_admin_1',
      email: 'admin@outreach.org',
      full_name: 'Admin',
      role: 'administrator',
      is_active: true,
      password_hash: hashPassword('StrongPassword123!'),
      created_at: now,
      updated_at: now,
    })

    const prodConfig = loadConfig({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a_very_strong_random_jwt_secret_value_32chars',
      SQLITE_DB_PATH: '/data/tmas-reach.sqlite',
      CORS_ORIGIN: 'https://reach.outreach.org',
      APP_PUBLIC_URL: 'https://reach.outreach.org',
      RESEND_API_KEY: 're_live_example_key_12345',
      EMAIL_FROM_ADDRESS: 'TMAS <outreach@mail.outreach.org>',
      WEBHOOK_SIGNING_SECRET: 'whsec_prod_signing_secret',
    })

    const prodReport = evaluateReadiness(prodConfig)
    expect(prodReport.readyForLiveOutreach).toBe(true)
    expect(prodReport.providerMode).toBe('resend')
    expect(prodReport.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  it('verifies Resend domain status cleanly across configured, pending, missing, and error states', async () => {
    const unconfigured = await verifyResendDomain(loadConfig({}))
    expect(unconfigured.configured).toBe(false)
    expect(unconfigured.verified).toBe(false)

    const prodConfig = loadConfig({
      RESEND_API_KEY: 're_live_key',
      EMAIL_FROM_ADDRESS: 'Outreach <hello@mail.school.org>',
    })

    const verifiedRes = await verifyResendDomain(prodConfig, {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                name: 'mail.school.org',
                status: 'verified',
                records: [{ record: 'TXT', name: '_dmarc', type: 'TXT', value: 'v=DMARC1' }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    })
    expect(verifiedRes.verified).toBe(true)
    expect(verifiedRes.domain).toBe('mail.school.org')
    expect(verifiedRes.records).toHaveLength(1)

    const pendingRes = await verifyResendDomain(prodConfig, {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            data: [{ name: 'mail.school.org', status: 'pending' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    })
    expect(pendingRes.verified).toBe(false)
    expect(pendingRes.status).toBe('pending')

    const missingRes = await verifyResendDomain(prodConfig, {
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    })
    expect(missingRes.status).toBe('not_found')

    const networkErrRes = await verifyResendDomain(prodConfig, {
      fetchImpl: async () => {
        throw new Error('Connection reset')
      },
    })
    expect(networkErrRes.status).toBe('network_error')
  })

  it('enforces administrator RBAC on readiness and domain verification routes', async () => {
    const baseUrl = await startTestApp()

    const leadRes = await fetch(`${baseUrl}/api/system/readiness`, {
      headers: { 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_lead' },
    })
    expect(leadRes.status).toBe(403)

    const adminRes = await fetch(`${baseUrl}/api/system/readiness`, {
      headers: { 'x-user-role': 'administrator', 'x-user-id': 'usr_admin' },
    })
    expect(adminRes.status).toBe(200)
    const report = (await adminRes.json()) as { checks: Array<{ id: string }> }
    expect(report.checks).toHaveLength(8)

    const domainRes = await fetch(`${baseUrl}/api/system/verify-domain`, {
      method: 'POST',
      headers: { 'x-user-role': 'administrator', 'x-user-id': 'usr_admin' },
    })
    expect(domainRes.status).toBe(200)
  })
})

describe('API CRUD Parity & Test Send Routes', () => {
  it('supports template edit, duplicate, and prevents deleting templates used by campaigns', async () => {
    const baseUrl = await startTestApp()
    const headers = {
      'Content-Type': 'application/json',
      'x-user-role': 'marketing_intern',
      'x-user-id': 'usr_intern',
    }

    const createTpl = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Spring STEM',
        subject_template: 'Hello {{first_name}}',
        body_text: 'Body {{unsubscribe_url}}',
      }),
    })
    expect(createTpl.status).toBe(201)
    const tpl = (await createTpl.json()) as { id: string }

    const patchTpl = await fetch(`${baseUrl}/api/templates/${tpl.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Spring STEM Updated' }),
    })
    expect(patchTpl.status).toBe(200)
    expect(((await patchTpl.json()) as { name: string }).name).toBe('Spring STEM Updated')

    const dupTpl = await fetch(`${baseUrl}/api/templates/${tpl.id}/duplicate`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_intern' },
    })
    expect(dupTpl.status).toBe(201)
    const copy = (await dupTpl.json()) as { id: string; name: string }
    expect(copy.name).toBe('Spring STEM Updated (Copy)')

    // Reference first template in a campaign -> cannot delete
    const cmpRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Spring Batch',
        template_id: tpl.id,
        target_audience_tag: 'high_school',
      }),
    })
    expect(cmpRes.status).toBe(201)

    const delBlocked = await fetch(`${baseUrl}/api/templates/${tpl.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_intern' },
    })
    expect(delBlocked.status).toBe(409)

    const delCopy = await fetch(`${baseUrl}/api/templates/${copy.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_intern' },
    })
    expect(delCopy.status).toBe(200)
  })

  it('supports campaign edit, reopen, recipients list, and test-send', async () => {
    const baseUrl = await startTestApp()
    const internHeaders = {
      'Content-Type': 'application/json',
      'x-user-role': 'marketing_intern',
      'x-user-id': 'usr_intern',
      'x-user-email': 'intern@school.edu',
    }
    const leadHeaders = {
      'Content-Type': 'application/json',
      'x-user-role': 'marketing_lead',
      'x-user-id': 'usr_lead',
    }

    await fetch(`${baseUrl}/api/contacts`, {
      method: 'POST',
      headers: internHeaders,
      body: JSON.stringify({
        email: 'teacher@oak.edu',
        first_name: 'Jane',
        organization: 'Oak High',
        district: 'North District',
        audience_tag: 'high_school',
      }),
    })

    const cmpRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: internHeaders,
      body: JSON.stringify({
        name: 'Draft Outreach',
        template_id: templatesDb[0].id,
        target_audience_tag: 'high_school',
        batch_size: 20,
      }),
    })
    const cmp = (await cmpRes.json()) as { id: string }

    const editRes = await fetch(`${baseUrl}/api/campaigns/${cmp.id}`, {
      method: 'PATCH',
      headers: internHeaders,
      body: JSON.stringify({ name: 'Edited Draft', batch_size: 40 }),
    })
    expect(editRes.status).toBe(200)
    expect(((await editRes.json()) as { batch_size: number }).batch_size).toBe(40)

    const testSend = await fetch(`${baseUrl}/api/campaigns/${cmp.id}/test-send`, {
      method: 'POST',
      headers: internHeaders,
      body: JSON.stringify({}),
    })
    expect(testSend.status).toBe(200)
    const testBody = (await testSend.json()) as { success: boolean; to: string; providerMode: string }
    expect(testBody.success).toBe(true)
    expect(testBody.to).toBe('intern@school.edu')
    expect(testBody.providerMode).toBe('mock')

    await fetch(`${baseUrl}/api/campaigns/${cmp.id}/submit`, {
      method: 'POST',
      headers: internHeaders,
    })

    await fetch(`${baseUrl}/api/campaigns/${cmp.id}/review`, {
      method: 'POST',
      headers: leadHeaders,
      body: JSON.stringify({ action: 'reject', review_notes: 'Tweak subject' }),
    })

    const reopenRes = await fetch(`${baseUrl}/api/campaigns/${cmp.id}/reopen`, {
      method: 'POST',
      headers: internHeaders,
    })
    expect(reopenRes.status).toBe(200)
    expect(((await reopenRes.json()) as { status: string }).status).toBe('draft')

    await fetch(`${baseUrl}/api/campaigns/${cmp.id}/submit`, {
      method: 'POST',
      headers: internHeaders,
    })
    await fetch(`${baseUrl}/api/campaigns/${cmp.id}/review`, {
      method: 'POST',
      headers: leadHeaders,
      body: JSON.stringify({ action: 'approve' }),
    })

    const recipsRes = await fetch(`${baseUrl}/api/campaigns/${cmp.id}/recipients`, {
      headers: internHeaders,
    })
    expect(recipsRes.status).toBe(200)
    const recips = (await recipsRes.json()) as Array<{ email: string }>
    expect(recips).toHaveLength(1)
    expect(recips[0].email).toBe('teacher@oak.edu')

    const allRecips = await fetch(`${baseUrl}/api/recipients`, { headers: internHeaders })
    expect(allRecips.status).toBe(200)
    expect((await allRecips.json()) as unknown[]).toHaveLength(1)
  })

  it('supports survey district carry-over, survey archiving, and lead bulk contact actions', async () => {
    const baseUrl = await startTestApp()
    const internHeaders = {
      'Content-Type': 'application/json',
      'x-user-role': 'marketing_intern',
      'x-user-id': 'usr_intern',
    }
    const leadHeaders = {
      'Content-Type': 'application/json',
      'x-user-role': 'marketing_lead',
      'x-user-id': 'usr_lead',
    }

    const s1 = await fetch(`${baseUrl}/api/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'one@school.edu',
        first_name: 'One',
        last_name: 'Teacher',
        organization: 'East High',
        district: 'East District',
        job_role: 'Teacher',
        audience_tag: 'high_school',
        consent_outreach: true,
      }),
    })
    const s1Body = (await s1.json()) as { submission_id: string }

    const s2 = await fetch(`${baseUrl}/api/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'two@school.edu',
        first_name: 'Two',
        last_name: 'Teacher',
        organization: 'West High',
        job_role: 'Teacher',
        audience_tag: 'high_school',
        consent_outreach: true,
      }),
    })
    const s2Body = (await s2.json()) as { submission_id: string }

    const promo = await fetch(`${baseUrl}/api/surveys/${s1Body.submission_id}/promote`, {
      method: 'POST',
      headers: internHeaders,
    })
    expect(promo.status).toBe(200)
    const promoBody = (await promo.json()) as { contact: { id: string; district: string } }
    expect(promoBody.contact.district).toBe('East District')

    const arch = await fetch(`${baseUrl}/api/surveys/${s2Body.submission_id}/archive`, {
      method: 'POST',
      headers: internHeaders,
    })
    expect(arch.status).toBe(200)
    expect(((await arch.json()) as { survey: { status: string } }).survey.status).toBe('archived')

    const internBulk = await fetch(`${baseUrl}/api/contacts/bulk-status`, {
      method: 'POST',
      headers: internHeaders,
      body: JSON.stringify({ ids: [promoBody.contact.id], status: 'suppressed' }),
    })
    expect(internBulk.status).toBe(403)

    const leadBulkStatus = await fetch(`${baseUrl}/api/contacts/bulk-status`, {
      method: 'POST',
      headers: leadHeaders,
      body: JSON.stringify({ ids: [promoBody.contact.id], status: 'suppressed' }),
    })
    expect(leadBulkStatus.status).toBe(200)
    expect(contactsDb[0].status).toBe('suppressed')

    const leadBulkDel = await fetch(`${baseUrl}/api/contacts/bulk-delete`, {
      method: 'POST',
      headers: leadHeaders,
      body: JSON.stringify({ ids: [promoBody.contact.id] }),
    })
    expect(leadBulkDel.status).toBe(200)
    expect(contactsDb).toHaveLength(0)
  })
})
