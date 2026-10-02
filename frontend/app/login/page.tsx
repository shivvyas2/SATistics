'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { clearAccountCache } from '@/lib/useAccount'
import { takePendingProfile } from '@/lib/profile'
import { AuthShell, Field, FormError } from '@/components/auth/AuthShell'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.login(email, password)

      if (!response.access_token) {
        throw new Error('Login failed: no session was returned. Try again.')
      }

      clearAccountCache()

      // A profile filled in before email confirmation is saved on first login
      const pending = takePendingProfile(email)
      if (pending) {
        try {
          await apiClient.saveProfile(pending)
        } catch (profileError: any) {
          const notice = encodeURIComponent(profileError.message || 'Your profile could not be saved.')
          router.push(`/profile?setup=1&notice=${notice}`)
          router.refresh()
          return
        }
      }

      // Only follow same-site paths, so a crafted link can't send people elsewhere after login
      const redirect = searchParams.get('redirect')
      const safeRedirect = redirect && /^\/(?![\/\\])/.test(redirect) ? redirect : '/dashboard'
      router.push(safeRedirect)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'Login failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={
        <>
          Back for
          <span className="block font-serif font-normal italic">another round?</span>
        </>
      }
      caption="Your streak, scores and weak topics are where you left them."
    >
      <h2 className="text-4xl font-extrabold tracking-tight">Log in</h2>
      <p className="mt-2 text-ink/65">
        New here?{' '}
        <Link href="/signup" className="font-bold text-cobalt underline decoration-2 underline-offset-4">
          Create a profile
        </Link>
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <FormError message={error} />

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="field"
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="field"
          />
        </Field>

        <button type="submit" disabled={loading} className="btn btn-ink w-full py-3.5 text-base">
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <Link href="/" className="mt-10 text-sm font-semibold text-ink/55 hover:text-ink">
        Back to satistics.tech
      </Link>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="theme-paper" />}>
      <LoginForm />
    </Suspense>
  )
}
