import { describe, it, expect, beforeEach } from 'vitest'
import { AppStore } from '../store'

describe('User & Team Management', () => {
  let store: AppStore

  beforeEach(() => {
    store = new AppStore()
    store.resetToDefault()
  })

  it('initializes with seed users with generic domains', () => {
    const users = store.getUsers()
    expect(users.length).toBeGreaterThanOrEqual(3)
    expect(users.some((u) => u.email.endsWith('@tmasacademy.org'))).toBe(false)
  })

  it('adds a team member with personal or university email domain', () => {
    const res = store.addUser({
      email: 'student.intern@stanford.edu',
      full_name: 'Stanford Intern',
      role: 'marketing_intern',
    })

    expect(res.success).toBe(true)
    expect(res.user?.email).toBe('student.intern@stanford.edu')

    const users = store.getUsers()
    expect(users.some((u) => u.email === 'student.intern@stanford.edu')).toBe(true)
  })

  it('rejects duplicate member email additions', () => {
    store.addUser({
      email: 'duplicate@test.org',
      full_name: 'Test Member',
      role: 'marketing_intern',
    })

    const duplicateRes = store.addUser({
      email: 'duplicate@test.org',
      full_name: 'Test Member Duplicate',
      role: 'marketing_lead',
    })

    expect(duplicateRes.success).toBe(false)
    expect(duplicateRes.error).toContain('already exists')
  })

  it('switches current active user', () => {
    const users = store.getUsers()
    const target = users[1]
    store.setCurrentUser(target.id)

    expect(store.getCurrentUser().id).toBe(target.id)
    expect(store.getCurrentUser().role).toBe(target.role)
  })

  it('protects against deleting the last administrator', () => {
    const admins = store.getUsers().filter((u) => u.role === 'administrator')
    expect(admins.length).toBe(1)

    const res = store.deleteUser(admins[0].id)
    expect(res.success).toBe(false)
    expect(res.error).toContain('last administrator')
  })

  it('bulk imports team members from parsed rows', () => {
    const rows = [
      { email: 'intern1@gmail.com', full_name: 'Intern 1', role: 'marketing_intern' as const },
      { email: 'intern2@yahoo.com', full_name: 'Intern 2', role: 'marketing_intern' as const },
      { email: 'lead1@berkeley.edu', full_name: 'Lead 1', role: 'marketing_lead' as const },
    ]

    const result = store.importUsers(rows)
    expect(result.imported).toBe(3)

    const updatedUsers = store.getUsers()
    expect(updatedUsers.some((u) => u.email === 'intern1@gmail.com')).toBe(true)
    expect(updatedUsers.some((u) => u.email === 'intern2@yahoo.com')).toBe(true)
    expect(updatedUsers.some((u) => u.email === 'lead1@berkeley.edu')).toBe(true)
  })
})
