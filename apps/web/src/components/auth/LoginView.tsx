import { useState } from 'react'
import type { User } from '../../types'
import { bootstrapAdmin, loginWithPassword } from '../../lib/authSession'
import type { ApiClient } from '../../lib/apiClient'
import tmasLogo from '../../assets/tmas-logo.jpg'
import { AlertCircle, ExternalLink, Lock, Mail, Moon, ShieldCheck, Sun, User as UserIcon } from 'lucide-react'

interface LoginViewProps {
  initialized: boolean
  isDark: boolean
  onToggleTheme: () => void
  onAuthenticated: (user: User, isBootstrap: boolean) => void
  onOpenUnsubscribe: () => void
  client?: ApiClient
}

export function LoginView({
  initialized,
  isDark,
  onToggleTheme,
  onAuthenticated,
  onOpenUnsubscribe,
  client,
}: LoginViewProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Email address is required.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (!initialized && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (initialized) {
        const user = await loginWithPassword(trimmedEmail, password, client)
        onAuthenticated(user, false)
      } else {
        const user = await bootstrapAdmin(
          {
            email: trimmedEmail,
            full_name: fullName.trim() || trimmedEmail.split('@')[0],
            password,
          },
          client
        )
        onAuthenticated(user, true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col justify-between px-4 py-8">
      <div className="mx-auto flex w-full max-w-md justify-end">
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-slate-700" />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={tmasLogo}
            alt="TMAS Academy"
            className="h-11 w-11 rounded-xl bg-black object-contain shadow-xs"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {initialized ? 'Sign in to TMAS Reach' : 'Set Up Administrator Account'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {initialized
                ? 'Use your team email and password to access outreach workspaces.'
                : 'Create the first administrator account to secure this workspace.'}
            </p>
          </div>
        </div>

        {!initialized && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Once this administrator account is created, interns and leads can be invited from Team & RBAC.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!initialized && (
            <div>
              <label
                htmlFor="auth-full-name"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Full Name *
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="auth-full-name"
                  type="text"
                  required
                  placeholder="Alex Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Email Address *
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Password *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={initialized ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {!initialized && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="auth-confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
          >
            {submitting
              ? initialized
                ? 'Signing in...'
                : 'Creating administrator...'
              : initialized
                ? 'Sign In'
                : 'Create Administrator & Continue'}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenUnsubscribe}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Public Unsubscribe Portal</span>
          </button>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">
        TMAS Reach · Authenticated Workspace
      </div>
    </div>
  )
}
