'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { clearAccountCache } from '@/lib/useAccount'
import { getExamPrefs, setExamPrefs } from '@/lib/exam'
import { EMPTY_PROFILE, Profile, savePendingProfile } from '@/lib/profile'
import { AuthShell, Field, FormError } from '@/components/auth/AuthShell'
import { GoalFields, IdentityFields, validateProfile } from '@/components/profile/ProfileFields'
import { ArrowLeft } from '@/components/brand/Icons'

const STEPS = ['Account', 'Profile', 'Goal']

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profile, setProfile] = useState<Profile>({
    ...EMPTY_PROFILE,
    exam: searchParams.get('exam') === 'gre' ? 'gre' : 'sat',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const checkStep = (): string | null => {
    if (step === 0) {
      if (password.length < 6) return 'Passwords need at least 6 characters.'
      if (password !== confirmPassword) return 'The two passwords don’t match.'
    }
    if (step >= 1) return validateProfile(profile)
    return null
  }

  const createAccount = async () => {
    setLoading(true)
    try {
      const response = await apiClient.signup(email, password)
      if (!response.success) throw new Error(response.error || 'Signup failed. Try again.')

      clearAccountCache()

      // Practice settings start on the exam they chose
      setExamPrefs({ ...getExamPrefs(), exam: profile.exam })

      if (!response.access_token) {
        // Email confirmation is on: keep the profile until their first login
        savePendingProfile(email, profile)
        setAwaitingConfirmation(true)
        return
      }

      try {
        await apiClient.saveProfile(profile)
      } catch (profileError: any) {
        // The account exists; send them to finish the profile instead of failing signup
        const notice = encodeURIComponent(profileError.message || 'Your profile could not be saved.')
        router.push(`/profile?setup=1&notice=${notice}`)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Signup failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = checkStep()
    setError(problem)
    if (problem) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else createAccount()
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Almost in." caption="Confirm your email and your profile will be waiting.">
        <h2 className="text-4xl font-extrabold tracking-tight">Check your inbox</h2>
        <p className="mt-3 text-lg text-ink/70">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then log in to start your first game.
        </p>
        <Link href="/login" className="btn btn-ink mt-8 w-full py-3.5 text-base">
          Go to log in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={
        <>
          Your score,
          <span className="block font-serif font-normal italic">leveled up.</span>
        </>
      }
      caption="Set your exam and target once. Every game after that is aimed at closing the gap."
    >
      {/* Progress through the three steps */}
      <ol className="mb-8 flex gap-2" aria-label="Signup progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={`h-2 rounded-full border-2 border-ink ${i <= step ? 'bg-cobalt' : 'bg-white'}`} />
            <span className={`mt-2 block text-[13px] font-bold ${i === step ? 'text-ink' : 'text-ink/45'}`}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <h2 className="text-4xl font-extrabold tracking-tight">
        {['Create your account', 'Make it yours', 'Set your goal'][step]}
      </h2>
      {step === 0 && (
        <p className="mt-2 text-ink/65">
          Already training?{' '}
          <Link href="/login" className="font-bold text-cobalt underline decoration-2 underline-offset-4">
            Log in
          </Link>
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={step > 0}>
        <FormError message={error} />

        {step === 0 && (
          <>
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field" placeholder="you@example.com" />
            </Field>
            <Field label="Password" htmlFor="password" hint="At least 6 characters.">
              <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="field" />
            </Field>
            <Field label="Confirm password" htmlFor="confirmPassword">
              <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="field" />
            </Field>
          </>
        )}
        {step === 1 && <IdentityFields value={profile} onChange={setProfile} />}
        {step === 2 && <GoalFields value={profile} onChange={setProfile} />}

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setStep(step - 1)
              }}
              className="btn btn-paper px-4"
              aria-label="Back"
            >
              <ArrowLeft />
            </button>
          )}
          <button type="submit" disabled={loading} className="btn btn-ink flex-1 py-3.5 text-base">
            {step < STEPS.length - 1 ? 'Continue' : loading ? 'Creating your profile…' : 'Create profile'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="theme-paper" />}>
      <SignupForm />
    </Suspense>
  )
}
