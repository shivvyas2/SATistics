'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { FormError } from '@/components/auth/AuthShell'
import { Avatar, GoalFields, IdentityFields, slugifyUsername, validateProfile } from '@/components/profile/ProfileFields'
import { YourData } from '@/components/profile/YourData'
import { apiClient } from '@/lib/api/client'
import { useAccount } from '@/lib/useAccount'
import { EXAMS, getExamPrefs, setExamPrefs } from '@/lib/exam'
import { EMPTY_PROFILE, Profile, daysUntil } from '@/lib/profile'

function ProfileEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSetup = searchParams.get('setup') === '1'
  const notice = searchParams.get('notice')
  const { account, updateProfile } = useAccount()
  const [draft, setDraft] = useState<Profile | null>(null)
  const [topics, setTopics] = useState<{ strong: string[]; weak: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Start editing from the saved profile, or a fresh one seeded from the email
  useEffect(() => {
    if (!account || draft) return
    const emailName = account.user?.email?.split('@')[0] ?? ''
    setDraft(account.profile ?? { ...EMPTY_PROFILE, display_name: emailName, username: slugifyUsername(emailName) })
  }, [account, draft])

  useEffect(() => {
    apiClient.getUserStats().then((s) => setTopics(s ? { strong: s.strong_topics ?? [], weak: s.weak_topics ?? [] } : { strong: [], weak: [] }))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const problem = validateProfile(draft)
    setError(problem)
    setSaved(false)
    if (problem) return

    setSaving(true)
    try {
      const profile = await apiClient.saveProfile(draft)
      updateProfile(profile)
      setExamPrefs({ ...getExamPrefs(), exam: profile.exam })
      if (isSetup) {
        router.push('/dashboard')
        return
      }
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'Your profile could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const countdown = daysUntil(draft?.test_date ?? null)

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      {isSetup && (
        <div className="mb-6 rounded-[24px] border-2 border-ink bg-lime p-5">
          <p className="text-lg font-extrabold">Your account is ready. Finish your profile to start.</p>
          {notice && <p className="mt-1 text-sm">{notice}</p>}
        </div>
      )}

      {/* Header card */}
      {draft ? (
        <section className="relative overflow-hidden rounded-[28px] border-2 border-ink bg-cobalt p-6 text-white shadow-brutal sm:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar profile={draft} size={88} />
            <div className="min-w-0">
              <h1 className="truncate text-4xl font-extrabold tracking-tight">{draft.display_name || 'Your name'}</h1>
              <p className="text-white/70">@{draft.username || 'username'}</p>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3">
            {[
              ['Exam', EXAMS[draft.exam].name],
              ['Target', draft.target_score ?? 'Not set'],
              ['Test day', countdown === null ? 'Not set' : countdown < 0 ? 'Done' : `${countdown} days`],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-white/30 bg-white/15 p-3 backdrop-blur">
                <dt className="text-xs text-white/70">{label}</dt>
                <dd className="text-xl font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <div className="h-60 animate-pulse rounded-[28px] bg-white" />
      )}

      {draft && (
        <form onSubmit={save} noValidate className="mt-8 space-y-8">
          <FormError message={error} />
          <section className="rounded-[28px] border-2 border-ink bg-white p-6">
            <h2 className="mb-5 text-2xl font-extrabold">About you</h2>
            <IdentityFields value={draft} onChange={setDraft} />
          </section>
          <section className="rounded-[28px] border-2 border-ink bg-white p-6">
            <h2 className="mb-5 text-2xl font-extrabold">Your goal</h2>
            <GoalFields value={draft} onChange={setDraft} />
          </section>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="btn btn-ink px-8">
              {saving ? 'Saving…' : isSetup ? 'Save and start' : 'Save profile'}
            </button>
            <span aria-live="polite" className="text-sm font-bold text-cobalt">
              {saved && 'Profile saved'}
            </span>
          </div>
        </form>
      )}

      {/* Topic breakdown from game history */}
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {[
          { title: 'Strongest topics', list: topics?.strong, tone: 'bg-lime-soft', empty: 'Topics you answer well will collect here.' },
          { title: 'Topics to work on', list: topics?.weak, tone: 'bg-coral-soft', empty: 'Topics you miss most will collect here.' },
        ].map(({ title, list, tone, empty }) => (
          <div key={title} className={`rounded-[24px] border-2 border-ink p-5 ${tone}`}>
            <h2 className="text-lg font-extrabold">{title}</h2>
            {list === undefined ? (
              <div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-ink/10" />
            ) : list.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">{empty}</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {list.map((t) => (
                  <li key={t} className="chip bg-white text-[13px]">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <YourData />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <ProfileEditor />
      </Suspense>
    </DashboardLayout>
  )
}
