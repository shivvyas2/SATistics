import type { ExamId } from '@/lib/exam'

export interface Profile {
  display_name: string
  username: string
  exam: ExamId
  target_score: number | null
  test_date: string | null // ISO date, yyyy-mm-dd
  daily_minutes: number
  avatar_color: string
}

export const AVATAR_COLORS = ['#3A33E8', '#D4F34A', '#FF6B4A', '#F45D9C', '#17171C']

export const DAILY_MINUTES = [10, 20, 30, 45]

export const SCORE_RANGES: Record<ExamId, { min: number; max: number; step: number; label: string }> = {
  sat: { min: 400, max: 1600, step: 10, label: 'out of 1600' },
  gre: { min: 260, max: 340, step: 1, label: 'out of 340 (V + Q)' },
}

export const EMPTY_PROFILE: Profile = {
  display_name: '',
  username: '',
  exam: 'sat',
  target_score: null,
  test_date: null,
  daily_minutes: 20,
  avatar_color: AVATAR_COLORS[0],
}

export function initials(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// Text on an avatar must stay readable on light swatches
export function avatarTextColor(color: string): string {
  return color === '#D4F34A' ? '#17171C' : '#FFFFFF'
}

/*
 * When Supabase requires email confirmation, signup returns no session, so the
 * profile can't be saved yet. It waits here and is saved on the first login.
 */
const PENDING_KEY = 'pending_profile'

export function savePendingProfile(email: string, profile: Profile): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ email: email.toLowerCase(), profile }))
  } catch {
    // Storage unavailable: the user can fill in their profile after login
  }
}

export function takePendingProfile(email: string): Profile | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw)
    if (pending.email !== email.toLowerCase()) return null
    localStorage.removeItem(PENDING_KEY)
    return { ...EMPTY_PROFILE, ...pending.profile }
  } catch {
    return null
  }
}
