import type { Router, ApiRequest, ApiResponse } from '../server.js'
import { contactsDb } from './contacts.js'
import { campaignRecipientsDb } from './campaigns.js'

export function registerUnsubscribeRoutes(router: Router) {
  // GET /unsubscribe/:token — verify token
  router.get('/unsubscribe/:token', (req: ApiRequest, res: ApiResponse) => {
    const { token } = req.params
    const contact = contactsDb.find((c) => c.unsubscribe_token === token)

    if (!contact) {
      res.status(404).json({
        error: 'Invalid or expired unsubscribe link.',
      })
      return
    }

    res.status(200).json({
      valid: true,
      email: contact.email,
      organization: contact.organization,
      current_status: contact.status,
    })
  })

  // POST /unsubscribe — execute unsubscribe
  router.post('/unsubscribe', (req: ApiRequest, res: ApiResponse) => {
    const { token } = req.body || {}
    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    const contact = contactsDb.find((c) => c.unsubscribe_token === token)
    if (!contact) {
      res.status(404).json({ error: 'Invalid or expired unsubscribe link.' })
      return
    }

    contact.status = 'unsubscribed'
    contact.updated_at = new Date().toISOString()

    // Immediately cancel any queued deliveries for this contact
    let cancelledDeliveriesCount = 0
    campaignRecipientsDb.forEach((r) => {
      if (r.contact_id === contact.id && r.delivery_status === 'queued') {
        r.delivery_status = 'unsubscribed'
        cancelledDeliveriesCount++
      }
    })

    res.status(200).json({
      success: true,
      message: `The address ${contact.email} has been unsubscribed from all TMAS Academy communications.`,
      cancelledDeliveriesCount,
    })
  })
}
