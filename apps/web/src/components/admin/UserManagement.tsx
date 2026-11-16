import type { User, UserRole } from '../../types'
import { store } from '../../lib/store'
import { Users, Shield } from 'lucide-react'

interface UserManagementProps {
  users: User[]
}

export function UserManagement({ users }: UserManagementProps) {
  const handleRoleChange = (userId: string, newRole: UserRole) => {
    store.updateUserRole(userId, newRole)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          User & Role Management
        </h3>
        <p className="text-xs text-slate-500">
          Administrator-only access per Section 1 (Role Permissions Matrix)
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Assigned Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Role Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{user.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
                    <Shield className="h-3 w-3" />
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    Active
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="marketing_intern">Marketing Intern</option>
                    <option value="marketing_lead">Marketing Lead</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
