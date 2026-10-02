'use client'

import { Field } from '@/components/auth/AuthShell'
import { CheckIcon } from '@/components/brand/Icons'
import { EXAMS, ExamId } from '@/lib/exam'
import { AVATAR_COLORS, DAILY_MINUTES, Profile, SCORE_RANGES, avatarTextColor, initials } from '@/lib/profile'

interface Props {
  value: Profile
  onChange: (next: Profile) => void
}

export function Avatar({ profile, size = 56, className = '' }: { profile: Pick<Profile, 'display_name' | 'avatar_color'>; size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-extrabold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: profile.avatar_color, color: avatarTextColor(profile.avatar_color) }}
      aria-hidden="true"
    >
      {initials(profile.display_name)}
    </span>
  )
}

export function slugifyUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/

const segment = (selected: boolean) =>
  `flex-1 rounded-2xl border-2 border-ink px-4 py-3 text-left font-bold transition-colors ${selected ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'}`

export function IdentityFields({ value, onChange }: Props) {
  const set = (patch: Partial<Profile>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar profile={value} size={64} />
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Avatar color</legend>
          <div className="flex gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set({ avatar_color: color })}
                aria-label={`Avatar color ${color}`}
                aria-pressed={value.avatar_color === color}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink"
                style={{ backgroundColor: color, color: avatarTextColor(color) }}
              >
                {value.avatar_color === color && <CheckIcon className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <Field label="Your name" htmlFor="display_name">
        <input
          id="display_name"
          value={value.display_name}
          onChange={(e) => {
            const display_name = e.target.value
            // Keep suggesting a username until the user edits it themselves
            const suggested = slugifyUsername(value.display_name)
            set({ display_name, ...(value.username === suggested ? { username: slugifyUsername(display_name) } : {}) })
          }}
          required
          maxLength={60}
          autoComplete="name"
          className="field"
          placeholder="Maya Chen"
        />
      </Field>

      <Field label="Username" htmlFor="username" hint="3 to 24 lowercase letters, numbers or underscores.">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink/40">@</span>
          <input
            id="username"
            value={value.username}
            onChange={(e) => set({ username: e.target.value.toLowerCase() })}
            required
            pattern="[a-z0-9_]{3,24}"
            className="field pl-9"
            placeholder="maya_chen"
          />
        </div>
      </Field>
    </div>
  )
}

export function GoalFields({ value, onChange }: Props) {
  const set = (patch: Partial<Profile>) => onChange({ ...value, ...patch })
  const range = SCORE_RANGES[value.exam]

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">Which exam are you taking?</legend>
        <div className="flex gap-3">
          {(Object.keys(EXAMS) as ExamId[]).map((exam) => (
            <button
              key={exam}
              type="button"
              aria-pressed={value.exam === exam}
              onClick={() => set({ exam, target_score: null })}
              className={segment(value.exam === exam)}
            >
              <span className="block text-xl">{EXAMS[exam].name}</span>
              <span className="text-xs font-semibold opacity-70">{exam === 'sat' ? 'College admissions' : 'Grad school admissions'}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Target score" htmlFor="target_score" hint={range.label}>
          <input
            id="target_score"
            type="number"
            inputMode="numeric"
            min={range.min}
            max={range.max}
            step={range.step}
            value={value.target_score ?? ''}
            onChange={(e) => set({ target_score: e.target.value === '' ? null : Number(e.target.value) })}
            className="field"
            placeholder={value.exam === 'sat' ? '1450' : '320'}
          />
        </Field>
        <Field label="Test date" htmlFor="test_date" hint="Optional. Powers your countdown.">
          <input
            id="test_date"
            type="date"
            value={value.test_date ?? ''}
            onChange={(e) => set({ test_date: e.target.value || null })}
            className="field"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">Daily practice goal</legend>
        <div className="flex flex-wrap gap-2">
          {DAILY_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={value.daily_minutes === minutes}
              onClick={() => set({ daily_minutes: minutes })}
              className={`chip px-4 py-2 ${value.daily_minutes === minutes ? 'bg-lime' : 'bg-white hover:bg-lime-soft'}`}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

// Mirrors the backend's validation so errors show before the request
export function validateProfile(p: Profile): string | null {
  if (!p.display_name.trim()) return 'Add your name.'
  if (!USERNAME_PATTERN.test(p.username)) return 'Usernames are 3 to 24 lowercase letters, numbers or underscores.'
  const range = SCORE_RANGES[p.exam]
  if (p.target_score !== null && (p.target_score < range.min || p.target_score > range.max)) {
    return `Target score for the ${EXAMS[p.exam].name} must be between ${range.min} and ${range.max}.`
  }
  return null
}
