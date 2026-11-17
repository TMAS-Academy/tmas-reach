import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store'

describe('Recipient Delivery Tracking and Bounce Handling', () => {
  beforeEach(() => {
    store.resetToDefault()
  })

  it('records bounced recipient and automatically suppresses the underlying contact', () => {
    // Add active contact
    store.addContact({
      email: 'bounce.target@district.edu',
      first_name: 'Jordan',
      last_name: 'Lee',
      organization: 'West High',
      status: 'active',
    })
    const contact = store.getContacts().find((c) => c.email === 'bounce.target@district.edu')!

    // Add template and campaign
    store.addTemplate({
      name: 'Test Template',
      subject_template: 'Subject {{first_name}}',
      body_html: '<p>Content</p><a href="{{unsubscribe_url}}">Unsubscribe</a>',
      body_text: 'Content {{unsubscribe_url}}',
    })
    const template = store.getTemplates()[0]

    const campaign = store.addCampaign({
      name: 'Delivery Tracking Campaign',
      template_id: template.id,
      batch_size: 50,
      created_by: 'usr-1',
    })

    // Submit and approve campaign
    store.submitCampaign(campaign.id)
    store.reviewCampaign(campaign.id, 'approved', 'Approved for delivery test')

    // Dispatch batch
    const dispatchRes = store.dispatchCampaignBatch(campaign.id)
    expect(dispatchRes.sentCount).toBeGreaterThan(0)

    const recipients = store.getRecipientsForCampaign(campaign.id)
    const targetRecipient = recipients.find((r) => r.contact_id === contact.id)!
    expect(targetRecipient.delivery_status).toBe('delivered')

    // Simulate bounce
    const bounceRes = store.simulateRecipientBounce(targetRecipient.id)
    expect(bounceRes.success).toBe(true)

    // Recipient delivery status must be bounced
    const updatedRecipients = store.getRecipientsForCampaign(campaign.id)
    const updatedRecipient = updatedRecipients.find((r) => r.id === targetRecipient.id)!
    expect(updatedRecipient.delivery_status).toBe('bounced')

    // Contact must now be suppressed/bounced
    const updatedContact = store.getContacts().find((c) => c.id === contact.id)!
    expect(updatedContact.status).toBe('bounced')
  })
})
