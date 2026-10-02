'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'

export interface GameSession {
  id: string
  game_id: string
  score: number
  accuracy: number
  correct_answers: number
  wrong_answers: number
  max_streak: number
  created_at: string
}

export interface GameRecord {
  gameId: string
  plays: number
  bestScore: number
  lastPlayed: string
}

export function useRecentSessions(limit = 30) {
  const [sessions, setSessions] = useState<GameSession[] | null>(null)
  useEffect(() => {
    apiClient.getRecentSessions(limit).then((s) => setSessions(s as GameSession[]))
  }, [limit])
  return sessions
}

// Collapse sessions into one record per game, most recently played first
export function recordsByGame(sessions: GameSession[]): GameRecord[] {
  const map = new Map<string, GameRecord>()
  for (const s of sessions) {
    const rec = map.get(s.game_id)
    if (rec) {
      rec.plays += 1
      rec.bestScore = Math.max(rec.bestScore, s.score)
    } else {
      map.set(s.game_id, { gameId: s.game_id, plays: 1, bestScore: s.score, lastPlayed: s.created_at })
    }
  }
  return Array.from(map.values())
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
