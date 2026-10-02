'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/DashboardLayout'
import { GameCover } from '@/components/brand/GameCover'
import { PlayIcon } from '@/components/brand/Icons'
import { apiClient } from '@/lib/api/client'
import { gameTitle } from '@/lib/gameMeta'
import { GameSession, recordsByGame, timeAgo, useRecentSessions } from '@/lib/sessions'

interface UserStats {
  total_games_played: number
  total_score: number
  total_questions_answered: number
  total_correct: number
  total_wrong: number
  overall_accuracy: number
  weak_topics: string[]
  strong_topics: string[]
}

// How many recent sessions the accuracy chart shows
const TREND_LENGTH = 12

// Accuracy of each recent session, oldest on the left
function AccuracyTrend({ sessions }: { sessions: GameSession[] }) {
  const recent = sessions.slice(0, TREND_LENGTH).reverse()
  return (
    <section className="rounded-[24px] border-2 border-ink bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-extrabold">Accuracy, last {recent.length} {recent.length === 1 ? 'session' : 'sessions'}</h2>
        <span className="text-sm text-ink/55">oldest to newest</span>
      </div>
      <ol className="mt-4 flex h-36 items-end gap-2" aria-label="Accuracy per session">
        {recent.map((session) => {
          const accuracy = Math.round(session.accuracy * 100)
          return (
            <li key={session.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${gameTitle(session.game_id, session.game_id)}: ${accuracy}%`}>
              <span className="text-xs font-bold">{accuracy}%</span>
              <span
                className={`w-full rounded-t-lg border-2 border-ink ${accuracy >= 80 ? 'bg-lime' : accuracy >= 50 ? 'bg-cobalt' : 'bg-coral'}`}
                style={{ height: `${Math.max(6, accuracy * 0.8)}%` }}
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TopicList({ title, hint, topics, tone }: { title: string; hint: string; topics: string[]; tone: 'weak' | 'strong' }) {
  return (
    <section className={`rounded-[24px] border-2 border-ink p-5 ${tone === 'weak' ? 'bg-coral-soft' : 'bg-lime-soft'}`}>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {topics.length === 0 ? (
        <p className="mt-2 text-sm text-ink/65">{hint}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li key={topic} className="chip bg-white">
              {topic}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<UserStats | null | undefined>(undefined)
  const sessions = useRecentSessions(50)

  useEffect(() => {
    apiClient.getUserStats().then(setStats)
  }, [])

  const isLoading = stats === undefined || sessions === null
  const hasPlayed = !!stats && stats.total_games_played > 0
  const bestStreak = Math.max(0, ...(sessions ?? []).map((s) => s.max_streak))
  const records = recordsByGame(sessions ?? [])

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-5 sm:p-8">
        <h1 className="text-5xl font-extrabold tracking-tight">Statistics</h1>
        <p className="mt-2 max-w-xl text-ink/65">Where you stand, what to work on next, and how each game has gone.</p>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-[22px] bg-white" />
            ))}
          </div>
        ) : !hasPlayed ? (
          <div className="mt-8 rounded-[28px] border-2 border-dashed border-ink/40 p-8 text-center">
            <p className="text-2xl font-extrabold">Nothing to show yet</p>
            <p className="mx-auto mt-2 max-w-sm text-ink/65">Finish a game and your accuracy, streaks and weak topics will appear here.</p>
            <Link href="/games" className="btn btn-lime mt-5">
              <PlayIcon className="h-4 w-4" /> Play a game
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Games played', value: stats.total_games_played.toLocaleString(), className: 'bg-white' },
                { label: 'Accuracy', value: `${Math.round(stats.overall_accuracy * 100)}%`, className: 'bg-lime' },
                { label: 'Questions answered', value: stats.total_questions_answered.toLocaleString(), className: 'bg-white' },
                { label: 'Best streak', value: bestStreak, className: 'bg-cobalt text-white' },
              ].map((tile) => (
                <div key={tile.label} className={`rounded-[22px] border-2 border-ink p-4 shadow-brutal-sm ${tile.className}`}>
                  <dt className="text-sm opacity-70">{tile.label}</dt>
                  <dd className="mt-1 text-4xl font-extrabold tabular-nums">{tile.value}</dd>
                </div>
              ))}
            </dl>

            {/* Right versus wrong, all time */}
            <section className="rounded-[24px] border-2 border-ink bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-extrabold">Every answer so far</h2>
                <span className="text-sm text-ink/60">
                  {stats.total_correct.toLocaleString()} right, {stats.total_wrong.toLocaleString()} wrong
                </span>
              </div>
              <div className="mt-3 flex h-5 overflow-hidden rounded-full border-2 border-ink bg-coral">
                <div className="h-full border-r-2 border-ink bg-lime" style={{ width: `${stats.overall_accuracy * 100}%` }} />
              </div>
            </section>

            {sessions.length > 1 && <AccuracyTrend sessions={sessions} />}

            <div className="grid gap-4 sm:grid-cols-2">
              <TopicList
                title="Work on these"
                hint="No weak topics yet. They show up when you get under half of a topic's questions right."
                topics={stats.weak_topics ?? []}
                tone="weak"
              />
              <TopicList
                title="Going well"
                hint="Topics where you get at least four in five right will be listed here."
                topics={stats.strong_topics ?? []}
                tone="strong"
              />
            </div>

            {records.length > 0 && (
              <section>
                <h2 className="text-2xl font-extrabold">By game</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {records.map((record) => (
                    <li key={record.gameId}>
                      <Link
                        href={`/games/${record.gameId}/select`}
                        className="flex items-center gap-4 rounded-[24px] border-2 border-ink bg-white p-3 transition-transform hover:-translate-y-0.5"
                      >
                        <GameCover gameId={record.gameId} showTitle={false} className="aspect-square w-16 shrink-0 rounded-2xl border-2 border-ink" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{gameTitle(record.gameId, record.gameId)}</span>
                          <span className="text-sm text-ink/65">
                            {record.plays} {record.plays === 1 ? 'play' : 'plays'} · best {record.bestScore.toLocaleString()} pts · {timeAgo(record.lastPlayed)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sessions.length > 0 && (
              <section>
                <h2 className="text-2xl font-extrabold">Recent sessions</h2>
                <ul className="mt-4 divide-y-2 divide-ink/10 rounded-[24px] border-2 border-ink bg-white">
                  {sessions.slice(0, 15).map((session) => {
                    const accuracy = Math.round(session.accuracy * 100)
                    return (
                      <li key={session.id} className="flex items-center gap-4 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{gameTitle(session.game_id, session.game_id)}</span>
                          <span className="text-sm text-ink/60">
                            {session.correct_answers} right, {session.wrong_answers} wrong · {timeAgo(session.created_at)}
                          </span>
                        </span>
                        <span className={`chip tabular-nums ${accuracy >= 80 ? 'bg-lime' : accuracy >= 50 ? 'bg-white' : 'bg-coral-soft'}`}>{accuracy}%</span>
                        <span className="w-20 text-right font-extrabold tabular-nums">{session.score.toLocaleString()}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
