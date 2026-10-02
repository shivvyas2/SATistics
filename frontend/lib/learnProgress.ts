'use client'

import { useEffect, useState } from 'react'

// Lessons a viewer has marked as learned. Kept in this browser only.
const KEY = 'learned_lessons'

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function useLearned() {
  const [learned, setLearned] = useState<Set<string>>(new Set())
  useEffect(() => setLearned(new Set(read())), [])

  const toggle = (id: string) => {
    const next = new Set(learned)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setLearned(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.from(next)))
    } catch {
      // Storage unavailable: progress lasts for this visit only
    }
  }

  return { learned, toggle }
}

export const lessonId = (exam: string, topic: string) => `${exam}:${topic}`
