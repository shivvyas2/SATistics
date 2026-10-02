'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'
import type { Profile } from '@/lib/profile'

export interface Account {
  user: { id: string; email: string } | null
  profile: Profile | null
}

// Shared across pages so moving around the app doesn't refetch the account
let cached: Account | null = null
let inflight: Promise<Account> | null = null
const listeners = new Set<(a: Account) => void>()

async function loadAccount(): Promise<Account> {
  const user = (await apiClient.getCurrentUser().catch(() => null)) as Account['user']
  if (!user) return { user: null, profile: null }
  const profile = await apiClient.getProfile().catch((err) => {
    console.error('Could not load profile:', err)
    return null
  })
  return { user, profile }
}

export function setCachedProfile(profile: Profile | null) {
  if (!cached) return
  cached = { ...cached, profile }
  listeners.forEach((fn) => fn(cached!))
}

export function clearAccountCache() {
  cached = null
  inflight = null
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(cached)

  useEffect(() => {
    listeners.add(setAccount)
    if (!cached) {
      inflight ??= loadAccount()
      inflight.then((a) => {
        cached = a
        listeners.forEach((fn) => fn(a))
      })
    }
    return () => {
      listeners.delete(setAccount)
    }
  }, [])

  const updateProfile = useCallback((profile: Profile) => setCachedProfile(profile), [])

  return { account, loading: account === null, updateProfile }
}
