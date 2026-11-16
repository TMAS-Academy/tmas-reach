import { describe, it, expect } from 'vitest'
import { hasPermission } from '../rbac'

describe('Role-Based Access Control (RBAC) Matrix', () => {
  it('enforces Marketing Intern boundaries', () => {
    expect(hasPermission('marketing_intern', 'contacts:view')).toBe(true)
    expect(hasPermission('marketing_intern', 'contacts:create_edit')).toBe(true)
    expect(hasPermission('marketing_intern', 'contacts:import_csv')).toBe(true)
    expect(hasPermission('marketing_intern', 'templates:create_edit')).toBe(true)
    expect(hasPermission('marketing_intern', 'campaigns:create_edit')).toBe(true)
    expect(hasPermission('marketing_intern', 'campaigns:submit')).toBe(true)

    // Strictly blocked for interns
    expect(hasPermission('marketing_intern', 'contacts:suppress')).toBe(false)
    expect(hasPermission('marketing_intern', 'campaigns:review')).toBe(false)
    expect(hasPermission('marketing_intern', 'campaigns:dispatch')).toBe(false)
    expect(hasPermission('marketing_intern', 'users:manage')).toBe(false)
    expect(hasPermission('marketing_intern', 'analytics:export')).toBe(false)
  })

  it('enforces Marketing Lead permissions', () => {
    expect(hasPermission('marketing_lead', 'contacts:suppress')).toBe(true)
    expect(hasPermission('marketing_lead', 'campaigns:review')).toBe(true)
    expect(hasPermission('marketing_lead', 'campaigns:dispatch')).toBe(true)
    expect(hasPermission('marketing_lead', 'analytics:export')).toBe(true)

    // User management reserved for Admin
    expect(hasPermission('marketing_lead', 'users:manage')).toBe(false)
  })

  it('grants Administrator all system permissions', () => {
    expect(hasPermission('administrator', 'contacts:suppress')).toBe(true)
    expect(hasPermission('administrator', 'campaigns:review')).toBe(true)
    expect(hasPermission('administrator', 'campaigns:dispatch')).toBe(true)
    expect(hasPermission('administrator', 'analytics:export')).toBe(true)
    expect(hasPermission('administrator', 'users:manage')).toBe(true)
  })
})
