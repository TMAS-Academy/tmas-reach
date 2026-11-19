import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contactsDb, parseCsvRecords } from '../routes/contacts.js'
import { campaignsDb, campaignRecipientsDb, templatesDb } from '../routes/campaigns.js'
import { surveysDb } from '../routes/surveys.js'
import { activityLogsDb } from '../routes/logs.js'
import { buildDefaultRouter, createServerApp } from '../server.js'

const activeServers: http.Server[] = []
const originalPublicUrl = process.env.APP_PUBLIC_URL

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
  contactsDb.length = 0
  campaignsDb.length = 0
  campaignRecipientsDb.length = 0
  surveysDb.length = 0
  activityLogsDb.length = 0
  process.env.APP_PUBLIC_URL = 'https://portal.example.org'
})

afterEach(async () => {
  if (originalPublicUrl === undefined) {
    delete process.env.APP_PUBLIC_URL
  } else {
    process.env.APP_PUBLIC_URL = originalPublicUrl
  }
  while (activeServers.length > 0) {
    const srv = activeServers.pop()!
    if (srv.listening) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
  }
})

describe('API Route Validation, RBAC & State Transitions', () => {
  it('rejects unknown bearer tokens and invalid x-user-role headers with 401', async () => {
    const baseUrl = await startTestApp()

    const badBearer = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    expect(badBearer.status).toBe(401)

    const badRole = await fetch(`${baseUrl}/api/contacts`, {
      headers: { 'x-user-role': 'super_root' },
    })
    expect(badRole.status).toBe(401)

    const validIntern = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Authorization: 'Bearer intern-token' },
    })
    expect(validIntern.status).toBe(200)
  })

  it('parses RFC-4180 quoted CSV fields with embedded commas and escaped quotes', async () => {
    const csv = [
      'email,first_name,last_name,organization,job_role,audience_tag',
      '"ada@oak.edu","Ada","Lovelace, PhD","Oak Ridge, District 4","""Lead"" Teacher",high_school',
      'bad-email-row,No,At,School,Teacher,high_school',
    ].join('\r\n')

    const parsed = parseCsvRecords(csv)
    expect(parsed).toHaveLength(3)
    expect(parsed[1][2]).toBe('Lovelace, PhD')
    expect(parsed[1][3]).toBe('Oak Ridge, District 4')
    expect(parsed[1][4]).toBe('"Lead" Teacher')

    const baseUrl = await startTestApp()
    const res = await fetch(`${baseUrl}/api/contacts/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'marketing_intern',
        'x-user-id': 'usr_intern',
      },
      body: JSON.stringify({ csvContent: csv }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      summary: { importedCount: number; invalidRowsCount: number }
      createdContacts: Array<{ organization: string; unsubscribe_token: string }>
    }
    expect(body.summary.importedCount).toBe(1)
    expect(body.summary.invalidRowsCount).toBe(1)
    expect(body.createdContacts[0].organization).toBe('Oak Ridge, District 4')
    // Cryptographic 16-byte hex token (tok_ + 32 hex chars)
    expect(body.createdContacts[0].unsubscribe_token).toMatch(/^tok_[0-9a-f]{32}$/)
  })

  it('enforces marketing_lead+ RBAC on DELETE /api/contacts/:id', async () => {
    const baseUrl = await startTestApp()

    const createRes = await fetch(`${baseUrl}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
      body: JSON.stringify({ email: 'delete.me@school.edu', first_name: 'Sam' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { id: string }

    const internDelete = await fetch(`${baseUrl}/api/contacts/${created.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    expect(internDelete.status).toBe(403)

    const leadDelete = await fetch(`${baseUrl}/api/contacts/${created.id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
    })
    expect(leadDelete.status).toBe(200)
    expect(contactsDb).toHaveLength(0)
  })

  it('enforces pending_approval gate, uses APP_PUBLIC_URL, and prevents duplicate campaign recipients', async () => {
    const baseUrl = await startTestApp()

    const contactRes = await fetch(`${baseUrl}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
      body: JSON.stringify({
        email: 'math.chair@school.edu',
        first_name: 'Marie',
        organization: 'North High',
        audience_tag: 'high_school',
      }),
    })
    const contact = (await contactRes.json()) as { id: string; unsubscribe_token: string }

    const cmpRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
      body: JSON.stringify({
        name: 'Spring Math Challenge',
        template_id: templatesDb[0].id,
        target_audience_tag: 'high_school',
        batch_size: 25,
      }),
    })
    expect(cmpRes.status).toBe(201)
    const campaign = (await cmpRes.json()) as { id: string }

    // Cannot review a draft campaign before submit
    const prematureReview = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
      body: JSON.stringify({ action: 'approve' }),
    })
    expect(prematureReview.status).toBe(400)

    // Submit -> pending_approval
    const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/submit`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    expect(submitRes.status).toBe(200)

    // Intern cannot approve
    const internReview = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
      body: JSON.stringify({ action: 'approve' }),
    })
    expect(internReview.status).toBe(403)

    // Lead approves
    const approveRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
      body: JSON.stringify({ action: 'approve', review_notes: 'Ready to send' }),
    })
    expect(approveRes.status).toBe(200)
    expect(campaignRecipientsDb).toHaveLength(1)
    expect(campaignRecipientsDb[0].personalized_body).toContain(
      `https://portal.example.org/unsubscribe/${contact.unsubscribe_token}`
    )
    expect(campaignRecipientsDb[0].personalized_body).not.toContain('tmasacademy.org')

    // Re-approving an already approved campaign is rejected
    const duplicateReview = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'marketing_lead', 'x-user-id': 'usr_l' },
      body: JSON.stringify({ action: 'approve' }),
    })
    expect(duplicateReview.status).toBe(400)
    expect(campaignRecipientsDb).toHaveLength(1)

    // Unsubscribe cancels queued recipient immediately
    const unsubRes = await fetch(`${baseUrl}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: contact.unsubscribe_token }),
    })
    expect(unsubRes.status).toBe(200)
    const unsubBody = (await unsubRes.json()) as { cancelledDeliveriesCount: number }
    expect(unsubBody.cancelledDeliveriesCount).toBe(1)
    expect(campaignRecipientsDb[0].delivery_status).toBe('unsubscribed')
  })

  it('prevents double-promoting a survey submission', async () => {
    const baseUrl = await startTestApp()

    const submit = await fetch(`${baseUrl}/api/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'intake@district.edu',
        first_name: 'Elena',
        last_name: 'Rostova',
        organization: 'West District',
        job_role: 'Curriculum Director',
        audience_tag: 'district_admins',
        consent_outreach: true,
      }),
    })
    expect(submit.status).toBe(201)
    const { submission_id } = (await submit.json()) as { submission_id: string }

    const firstPromote = await fetch(`${baseUrl}/api/surveys/${submission_id}/promote`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    expect(firstPromote.status).toBe(200)

    const secondPromote = await fetch(`${baseUrl}/api/surveys/${submission_id}/promote`, {
      method: 'POST',
      headers: { 'x-user-role': 'marketing_intern', 'x-user-id': 'usr_i' },
    })
    expect(secondPromote.status).toBe(400)
  })
})
