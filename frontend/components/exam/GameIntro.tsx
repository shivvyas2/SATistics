'use client'

import Link from 'next/link'
import { GameCover } from '@/components/brand/GameCover'
import { ArrowLeft, PlayIcon } from '@/components/brand/Icons'

interface GameLoadingProps {
  gameId: string
  message: string
  // 0 to 1, or null while the amount of work left is unknown
  progress: number | null
}

/**
 * Loading screen shown while questions and 3D assets arrive
 */
export function GameLoading({ gameId, message, progress }: GameLoadingProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm text-center">
        <GameCover gameId={gameId} showTitle={false} className="brutal mx-auto aspect-square w-40 rounded-[28px] shadow-brutal-lg" />
        <p className="mt-6 text-xl font-extrabold">{message}</p>
        <div className="mt-4 h-4 overflow-hidden rounded-full border-2 border-ink bg-white">
          <div
            className={`h-full bg-lime transition-[width] duration-300 ${progress === null ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(8, (progress ?? 0.4) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

interface GameIntroProps {
  gameId: string
  // Shown above the title, e.g. the exam section
  kicker: string
  title: string
  // Last word or phrase of the title, set in the accent serif
  titleAccent: string
  summary: string
  // Each step is a short label (a key or action) and what it does
  steps: { label: string; text: string }[]
  startLabel: string
  onStart: () => void
}

/**
 * Screen shown before a game starts: what it is, how to play, and the way in or back out
 */
export function GameIntro({ gameId, kicker, title, titleAccent, summary, steps, startLabel, onStart }: GameIntroProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm">
      <div className="brutal grid w-full max-w-2xl overflow-hidden rounded-[28px] bg-paper text-ink shadow-brutal-lg sm:grid-cols-[200px_1fr]">
        <GameCover gameId={gameId} showTitle={false} className="hidden border-r-2 border-ink sm:block" />
        <div className="p-6">
          <p className="text-sm font-bold text-cobalt">{kicker}</p>
          <h1 className="mt-1 text-4xl font-extrabold leading-none tracking-tight">
            {title} <span className="font-serif font-normal italic">{titleAccent}</span>
          </h1>
          <p className="mt-3 text-[15px] text-ink/70">{summary}</p>

          <ul className="mt-5 space-y-2.5">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-3 text-[15px]">
                <span className="mt-0.5 flex-none rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-extrabold shadow-brutal-sm">
                  {step.label}
                </span>
                <span>{step.text}</span>
              </li>
            ))}
          </ul>

          <button onClick={onStart} className="btn btn-lime mt-6 w-full py-3.5 text-lg">
            <PlayIcon className="h-5 w-5" /> {startLabel}
          </button>
          <Link href="/games" className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-ink/60 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to games
          </Link>
        </div>
      </div>
    </div>
  )
}
