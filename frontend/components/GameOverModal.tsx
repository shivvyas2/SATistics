'use client'

import { GameAnalytics } from '@/games/whackamole/types'
import Link from 'next/link'

interface GameOverModalProps {
  analytics: GameAnalytics
  onRestart: () => void
  title?: string
  subtitle?: string
  // No longer shown; still accepted so existing callers keep compiling
  emoji?: string
  // Extra game-specific content shown above the action buttons
  children?: React.ReactNode
}

/**
 * Results screen shown when a game ends
 */
export function GameOverModal({
  analytics,
  onRestart,
  title = 'Game complete',
  subtitle,
  children,
}: GameOverModalProps) {
  // Without a game-specific message, match the tone to how the round went
  const tone =
    analytics.accuracy >= 80
      ? 'That was a strong round'
      : analytics.accuracy >= 50
      ? 'Solid. A few to go back over'
      : 'A tough one. The review below shows what to work on'
  const answered = analytics.correctAnswers + analytics.wrongAnswers
  const tiles = [
    { label: 'Score', value: analytics.score.toLocaleString(), className: 'bg-lime text-ink' },
    { label: 'Accuracy', value: `${analytics.accuracy.toFixed(0)}%`, className: 'bg-cobalt text-white' },
    { label: 'Correct', value: `${analytics.correctAnswers}/${answered}`, className: 'bg-white text-ink' },
    { label: 'Best streak', value: analytics.streakInfo.maxStreak, className: 'bg-coral text-ink' },
  ]
  const topics = Object.entries(analytics.topicPerformance)

  return (
    <div className="game-hud fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="dark-scroll max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border-2 border-lime bg-ink p-5 text-white shadow-[8px_8px_0_0_#D4F34A] sm:p-7">
        <div className="mb-6 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h2>
          <p className="mt-1 font-serif text-xl italic text-white/70">{subtitle ?? tone}</p>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className={`rounded-[20px] border-2 border-white/90 p-3 text-center ${tile.className}`}>
              <dd className="text-3xl font-extrabold tabular-nums">{tile.value}</dd>
              <dt className="mt-0.5 text-xs font-bold opacity-80">{tile.label}</dt>
            </div>
          ))}
        </dl>

        {topics.length > 0 && (
          <div className="mb-5 rounded-[20px] border border-white/15 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-bold">How you did by topic</h3>
            <div className="space-y-2.5">
              {topics.map(([topic, perf]) => (
                <div key={topic} className="flex items-center gap-3">
                  <div className="w-36 text-xs font-medium leading-tight">{topic}</div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-lime transition-all duration-500" style={{ width: `${perf.accuracy}%` }} />
                  </div>
                  <div className="w-10 text-right text-xs tabular-nums text-white/70">
                    {perf.correct}/{perf.total}
                  </div>
                </div>
              ))}
            </div>
            {answered > 0 && (
              <p className="mt-3 text-xs text-white/60">
                Average time per question: {(analytics.averageResponseTime / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        )}

        {children}

        <div className="grid gap-2 sm:grid-cols-3">
          <button onClick={onRestart} className="rounded-2xl border-2 border-lime bg-lime py-3 font-bold text-ink active:translate-y-0.5">
            Play again
          </button>
          <Link href="/stats" className="rounded-2xl border-2 border-white/80 py-3 text-center font-bold hover:bg-white/10">
            Your statistics
          </Link>
          <Link href="/games" className="rounded-2xl border-2 border-white/30 py-3 text-center font-bold text-white/80 hover:bg-white/10">
            Back to games
          </Link>
        </div>
      </div>
    </div>
  )
}
