import { createElement } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AppStore, MAX_ACTIVITY_LOGS, generateId, generateToken } from '../store'
import { useAppStore } from '../useAppStore'

describe('AppStore Resilience, Snapshots, and Cross-Tab Sync', () => {
  const storesToDispose: AppStore[] = []

  const createStore = () => {
    localStorage.clear()
    const s = new AppStore()
    storesToDispose.push(s)
    return s
  }

  afterEach(() => {
    while (storesToDispose.length > 0) {
      storesToDispose.pop()?.dispose()
    }
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('returns referentially stable cached snapshots until mutated', () => {
    const s = createStore()
    const snap1 = s.getSnapshot()
    const snap2 = s.getSnapshot()
    expect(snap1).toBe(snap2)

    s.addContact({ email: 'stable@school.edu', status: 'active' })
    const snap3 = s.getSnapshot()
    expect(snap3).not.toBe(snap1)
    expect(snap3.contacts.length).toBe(1)
    expect(snap1.contacts.length).toBe(0)
  })

  it('clones seed arrays on resetToDefault so prior mutations do not corrupt seeds', () => {
    const s = createStore()
    s.addUser({ email: 'extra@school.edu', full_name: 'Extra', role: 'marketing_intern' })
    expect(s.getUsers().some((u) => u.email === 'extra@school.edu')).toBe(true)

    s.resetToDefault()
    expect(s.getUsers().some((u) => u.email === 'extra@school.edu')).toBe(false)

    // Mutate returned array and verify another reset stays clean
    const usersCopy = s.getUsers()
    usersCopy.push({
      id: 'mutated',
      email: 'mutated@test.org',
      full_name: 'Mutated',
      role: 'marketing_intern',
      is_active: true,
      created_at: '',
      updated_at: '',
    })
    expect(s.getUsers().some((u) => u.id === 'mutated')).toBe(false)
  })

  it('caps the activity log buffer at MAX_ACTIVITY_LOGS', () => {
    const s = createStore()
    for (let i = 0; i < MAX_ACTIVITY_LOGS + 25; i++) {
      s.addContact({ email: `cap-${i}@school.edu`, status: 'active' })
    }
    expect(s.getLogs().length).toBe(MAX_ACTIVITY_LOGS)
  })

  it('syncs state across tabs when a window storage event fires', () => {
    const s = createStore()
    const listener = vi.fn()
    const unsub = s.subscribe(listener)

    const remoteContacts = [
      {
        id: 'cnt-remote-1',
        email: 'remote@district.edu',
        first_name: 'Remote',
        status: 'active',
        unsubscribe_token: 'tok-remote-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    localStorage.setItem('tmas_contacts', JSON.stringify(remoteContacts))

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'tmas_contacts',
        newValue: JSON.stringify(remoteContacts),
      })
    )

    expect(listener).toHaveBeenCalled()
    expect(s.getContacts().some((c) => c.email === 'remote@district.edu')).toBe(true)
    unsub()
  })

  it('notifies storage error listeners when QuotaExceededError occurs', () => {
    const s = createStore()
    const onError = vi.fn()
    const unsub = s.subscribeStorageError(onError)

    const quotaErr = new DOMException('Quota exceeded', 'QuotaExceededError')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaErr
    })

    s.addContact({ email: 'quota@school.edu', status: 'active' })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(s.getStorageError()).toContain('quota exceeded')
    expect(s.getSnapshot().storageError).toContain('quota exceeded')

    s.clearStorageError()
    expect(s.getStorageError()).toBeNull()
    unsub()
  })

  it('supports fallback ID and token generation when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
    })

    try {
      const id = generateId('cnt')
      const token = generateToken('tok')
      expect(id.startsWith('cnt-')).toBe(true)
      expect(token.startsWith('tok-')).toBe(true)
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      })
    }
  })

  it('prevents demoting the last remaining administrator', () => {
    const s = createStore()
    const admin = s.getUsers().find((u) => u.role === 'administrator')!
    const res = s.updateUserRole(admin.id, 'marketing_lead')
    expect(res.success).toBe(false)
    expect(res.error).toContain('last administrator')
    expect(s.getUsers().find((u) => u.id === admin.id)?.role).toBe('administrator')
  })

  it('re-renders components via useAppStore when store state updates', () => {
    const s = createStore()

    function Counter() {
      const snap = useAppStore(s)
      return createElement('div', { 'data-testid': 'count' }, snap.contacts.length)
    }

    const { getByTestId } = render(createElement(Counter))
    expect(getByTestId('count').textContent).toBe('0')

    act(() => {
      s.addContact({ email: 'hook@school.edu', status: 'active' })
    })
    expect(getByTestId('count').textContent).toBe('1')
  })
})
