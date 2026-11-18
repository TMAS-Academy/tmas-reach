import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../store'

describe('Contact Deletion and List Management', () => {
  beforeEach(() => {
    store.resetToDefault()
  })

  it('deletes an individual contact and cleans up associated data', () => {
    store.addContact({
      email: 'delete.me@school.org',
      first_name: 'Test',
      last_name: 'Delete',
      organization: 'Sample School',
      district: 'Sample District',
      status: 'active',
    })

    const added = store.getContacts().find((c) => c.email === 'delete.me@school.org')
    expect(added).toBeDefined()

    const res = store.deleteContact(added!.id)
    expect(res.success).toBe(true)
    expect(store.getContacts().some((c) => c.email === 'delete.me@school.org')).toBe(false)
  })

  it('performs bulk contact deletion', () => {
    store.addContact({ email: 'bulk1@school.org', status: 'active' })
    store.addContact({ email: 'bulk2@school.org', status: 'active' })

    const contacts = store.getContacts()
    const id1 = contacts.find((c) => c.email === 'bulk1@school.org')!.id
    const id2 = contacts.find((c) => c.email === 'bulk2@school.org')!.id

    const res = store.deleteContacts([id1, id2])
    expect(res.count).toBe(2)
    expect(store.getContacts().some((c) => c.email === 'bulk1@school.org')).toBe(false)
    expect(store.getContacts().some((c) => c.email === 'bulk2@school.org')).toBe(false)
  })

  it('persists and updates internal notes for a contact', () => {
    store.addContact({
      email: 'notes.educator@school.org',
      first_name: 'Robin',
      notes: 'Initial outreach via state math conference',
      status: 'active',
    })

    const contact = store.getContacts().find((c) => c.email === 'notes.educator@school.org')!
    expect(contact.notes).toBe('Initial outreach via state math conference')

    store.updateContact(contact.id, {
      notes: 'Followed up; scheduled demo for next month',
    })

    const updated = store.getContacts().find((c) => c.id === contact.id)!
    expect(updated.notes).toBe('Followed up; scheduled demo for next month')
  })
})
