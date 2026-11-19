import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { store } from '../../lib/store'
import { ContactList } from '../contacts/ContactList'
import { TemplateEditorModal } from '../templates/TemplateEditorModal'
import { CampaignDetailModal } from '../campaigns/CampaignDetailModal'
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard'
import { ActivityLogs } from '../analytics/ActivityLogs'
import { UserManagement } from '../admin/UserManagement'
import { UnsubscribePortal } from '../unsubscribe/UnsubscribePortal'
import { EducatorSurveyForm } from '../survey/EducatorSurveyForm'

describe('Core UI Workflows and Regression Guards', () => {
  beforeEach(() => {
    localStorage.clear()
    store.resetToDefault()
    window.history.replaceState(null, '', '/')
  })

  it('resets pagination on filter change and confirms deletion via ConfirmDialog in ContactList', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    for (let i = 1; i <= 12; i++) {
      store.addContact({
        email: `teacher${i}@school.edu`,
        first_name: `Teacher${i}`,
        organization: i === 12 ? 'North High' : 'South High',
        status: 'active',
      })
    }

    const { getByText, getByLabelText, queryByText } = render(
      <ContactList contacts={store.getContacts()} userRole="marketing_lead" />
    )

    // Go to page 2
    fireEvent.click(getByText('Next'))
    expect(getByText('2 / 2')).toBeTruthy()

    // Filter down to 1 matching contact; page must reset to 1 (no false empty state)
    const searchInput = getByLabelText('Search contacts')
    fireEvent.change(searchInput, { target: { value: 'North High' } })
    expect(getByText('teacher12@school.edu')).toBeTruthy()

    // Delete via ConfirmDialog without window.confirm
    fireEvent.click(getByLabelText('Delete teacher12@school.edu'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(getByText('Delete contact?')).toBeTruthy()
    fireEvent.click(getByText('Delete contact'))
    expect(queryByText('Delete contact?')).toBeNull()
    expect(store.getContacts().some((c) => c.email === 'teacher12@school.edu')).toBe(false)

    confirmSpy.mockRestore()
  })

  it('saves TemplateEditorModal even when preview tab is active and strips script tags', () => {
    const onSaved = vi.fn()
    const { getByLabelText, getByText, getByRole } = render(
      <TemplateEditorModal onClose={() => {}} onSaved={onSaved} />
    )

    fireEvent.change(getByLabelText(/Template Name/i), {
      target: { value: 'Spring Outreach' },
    })
    fireEvent.change(getByLabelText(/Subject Line Template/i), {
      target: { value: 'Workshop at {{school}}' },
    })
    fireEvent.change(getByLabelText(/Email Body \(HTML\)/i), {
      target: {
        value: '<p>Hello {{first_name}}</p><script>alert(1)</script><a href="{{unsubscribe_url}}">Unsub</a>',
      },
    })

    // Switch to preview tab and click Save
    fireEvent.click(getByRole('button', { name: /Live Sample Preview/i }))
    expect(document.querySelector('script')).toBeNull()

    fireEvent.click(getByText('Create Template'))
    expect(onSaved).toHaveBeenCalledWith('Template created.')
    expect(store.getTemplates().some((t) => t.name === 'Spring Outreach')).toBe(true)
  })

  it('allows reopening and resubmitting a rejected campaign and enforces RBAC labels', () => {
    store.addContact({ email: 'lead@school.edu', first_name: 'Sam', status: 'active' })
    const template = store.getTemplates()[0]
    const campaign = store.addCampaign({
      name: 'Fall Math Drive',
      template_id: template.id,
      batch_size: 25,
      created_by: 'usr-1',
    })
    store.submitCampaign(campaign.id)
    store.reviewCampaign(campaign.id, 'rejected', 'Tighten subject line')

    const rejected = store.getCampaigns().find((c) => c.id === campaign.id)!
    const onUpdated = vi.fn()

    const { getByText } = render(
      <CampaignDetailModal
        campaign={rejected}
        template={template}
        contacts={store.getContacts()}
        userRole="marketing_intern"
        onClose={() => {}}
        onUpdated={onUpdated}
      />
    )

    expect(getByText(/Rejected — Needs Revision/i)).toBeTruthy()
    fireEvent.click(getByText('Reopen as Draft'))
    expect(onUpdated).toHaveBeenCalled()
    expect(store.getCampaigns().find((c) => c.id === campaign.id)?.status).toBe('draft')
  })

  it('shows dash instead of 100.0% in AnalyticsDashboard when no messages have been sent', () => {
    const { getAllByText, getByText } = render(
      <AnalyticsDashboard contacts={[]} campaigns={[]} userRole="marketing_lead" />
    )

    expect(getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(getByText(/No campaigns created yet/i)).toBeTruthy()
  })

  it('filters ActivityLogs and renders formatted metadata pills instead of raw JSON', () => {
    const { getByLabelText, getByText, queryByText } = render(
      <ActivityLogs logs={store.getLogs()} />
    )

    expect(getByText('version:')).toBeTruthy()
    expect(getByText('1.0.0')).toBeTruthy()
    expect(queryByText('{"version":"1.0.0"}')).toBeNull()

    fireEvent.change(getByLabelText('Search activity logs'), {
      target: { value: 'nonexistent-query' },
    })
    expect(getByText(/No activity entries match your filters/i)).toBeTruthy()
  })

  it('blocks demoting the last administrator in UserManagement', () => {
    const onToast = vi.fn()
    const users = store.getUsers()
    const admin = users.find((u) => u.role === 'administrator')!

    const { getByLabelText } = render(
      <UserManagement users={users} currentUserId={admin.id} onToast={onToast} />
    )

    fireEvent.change(getByLabelText(`Change role for ${admin.full_name}`), {
      target: { value: 'marketing_lead' },
    })

    expect(onToast).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('last administrator')
    )
    expect(store.getUsers().find((u) => u.id === admin.id)?.role).toBe('administrator')
  })

  it('auto-fills ?token= in UnsubscribePortal and displays Already unsubscribed state', () => {
    store.addContact({ email: 'optedout@school.edu', first_name: 'Pat', status: 'unsubscribed' })
    const contact = store.getContacts().find((c) => c.email === 'optedout@school.edu')!
    window.history.replaceState(
      null,
      '',
      `/?tab=unsubscribe&token=${encodeURIComponent(contact.unsubscribe_token)}`
    )

    const { getByText, queryByText } = render(
      <UnsubscribePortal contacts={store.getContacts()} onBack={() => {}} />
    )

    expect(getByText(/Already unsubscribed/i)).toBeTruthy()
    expect(queryByText(/Confirm Opt-Out from All Outreach/i)).toBeNull()
  })

  it('keeps confirmation screen visible after EducatorSurveyForm submission and saves district', () => {
    const onSuccess = vi.fn()
    const { getByLabelText, getByText } = render(
      <EducatorSurveyForm onSuccess={onSuccess} />
    )

    fireEvent.change(getByLabelText(/First Name/i), { target: { value: 'Elena' } })
    fireEvent.change(getByLabelText(/Last Name/i), { target: { value: 'Gomez' } })
    fireEvent.change(getByLabelText(/School \/ Institutional Email/i), {
      target: { value: 'elena@north.edu' },
    })
    fireEvent.change(getByLabelText(/School or Organization/i), {
      target: { value: 'North High' },
    })
    fireEvent.change(getByLabelText(/School District/i), {
      target: { value: 'Metro Unified' },
    })

    fireEvent.click(getByText('Submit Survey'))

    expect(getByText('Information Received')).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(store.getSurveys()[0]?.district).toBe('Metro Unified')

    fireEvent.click(getByText('Done'))
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
