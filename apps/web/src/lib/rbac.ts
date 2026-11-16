import { UserRole } from '../types'

export type Permission =
  | 'contacts:view'
  | 'contacts:create_edit'
  | 'contacts:import_csv'
  | 'contacts:suppress'
  | 'templates:create_edit'
  | 'campaigns:create_edit'
  | 'campaigns:test_send'
  | 'campaigns:submit'
  | 'campaigns:review'
  | 'campaigns:dispatch'
  | 'analytics:view'
  | 'analytics:export'
  | 'users:manage'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  marketing_intern: [
    'contacts:view',
    'contacts:create_edit',
    'contacts:import_csv',
    'templates:create_edit',
    'campaigns:create_edit',
    'campaigns:test_send',
    'campaigns:submit',
    'analytics:view',
  ],
  marketing_lead: [
    'contacts:view',
    'contacts:create_edit',
    'contacts:import_csv',
    'contacts:suppress',
    'templates:create_edit',
    'campaigns:create_edit',
    'campaigns:test_send',
    'campaigns:submit',
    'campaigns:review',
    'campaigns:dispatch',
    'analytics:view',
    'analytics:export',
  ],
  administrator: [
    'contacts:view',
    'contacts:create_edit',
    'contacts:import_csv',
    'contacts:suppress',
    'templates:create_edit',
    'campaigns:create_edit',
    'campaigns:test_send',
    'campaigns:submit',
    'campaigns:review',
    'campaigns:dispatch',
    'analytics:view',
    'analytics:export',
    'users:manage',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'marketing_intern':
      return 'Marketing Intern'
    case 'marketing_lead':
      return 'Marketing Lead'
    case 'administrator':
      return 'Administrator'
  }
}
