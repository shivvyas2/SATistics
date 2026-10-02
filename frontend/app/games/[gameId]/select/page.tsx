'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { games } from '@/lib/games'
import { EXAMS, QUESTION_COUNTS, ExamId, ExamPrefs, SectionId, getExamPrefs, setExamPrefs } from '@/lib/exam'
import { DashboardLayout } from '@/components/DashboardLayout'
import Link from 'next/link'
import { GameCover } from '@/components/brand/GameCover'
import { ArrowLeft, PlayIcon } from '@/components/brand/Icons'
import { GAME_META } from '@/lib/gameMeta'
import { courseFor } from '@/lib/courses'

export default function GameSelectPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.gameId as string
  const game = games.find((g) => g.id === gameId)
  const [prefs, setPrefs] = useState<ExamPrefs | null>(null)

  // Saved prefs live in localStorage, so load them after mount
  useEffect(() => {
    setPrefs(getExamPrefs())
  }, [])

  const updatePrefs = (updates: Partial<ExamPrefs>) => {
    if (!prefs) return
    const next = { ...prefs, ...updates }
    setPrefs(next)
    setExamPrefs(next)
  }

  const optionClass = (selected: boolean) =>
    `flex-1 rounded-2xl border-2 border-ink px-3 py-2.5 text-sm font-bold transition-colors ${
      selected ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'
    }`

  if (!game) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="rounded-[24px] border-2 border-ink bg-coral-soft p-6">
            <p className="text-lg font-extrabold">That game doesn&apos;t exist.</p>
            <Link href="/games" className="mt-2 inline-block font-bold text-cobalt underline decoration-2 underline-offset-4">
              Back to all games
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const meta = GAME_META[game.id]

  return (
    <DashboardLayout>
      <div className="mx-auto grid max-w-5xl gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start">
        <div>
          <button onClick={() => router.back()} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink/60 hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <GameCover gameId={game.id} showTitle={false} className="brutal aspect-[3/4] rounded-[28px] shadow-brutal-lg" />
        </div>

        <div className="md:pt-12">
          <p className="text-sm font-bold text-cobalt">{meta?.genre}</p>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight">{meta?.title ?? game.name}</h1>
          <p className="mt-4 text-lg text-ink/70">{meta?.answerBy ?? game.description}.</p>

          {prefs ? (
            <div className="glass mt-8 space-y-6 rounded-[28px] p-6">
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Exam</legend>
                <div className="flex gap-2">
                  {(Object.keys(EXAMS) as ExamId[]).map((exam) => (
                    <button
                      key={exam}
                      onClick={() => updatePrefs({ exam })}
                      aria-pressed={prefs.exam === exam}
                      className={optionClass(prefs.exam === exam)}
                    >
                      {EXAMS[exam].name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Section</legend>
                <div className="flex gap-2">
                  {(Object.keys(EXAMS[prefs.exam].sections) as SectionId[]).map((section) => (
                    <button
                      key={section}
                      onClick={() => updatePrefs({ section })}
                      aria-pressed={prefs.section === section}
                      className={optionClass(prefs.section === section)}
                    >
                      {EXAMS[prefs.exam].sections[section].name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Questions</legend>
                <div className="flex gap-2">
                  {QUESTION_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => updatePrefs({ questionCount: count })}
                      aria-pressed={prefs.questionCount === count}
                      className={optionClass(prefs.questionCount === count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-ink/60">
                  Real exam pace: {EXAMS[prefs.exam].sections[prefs.section].pacing}
                </p>
              </fieldset>
              <ul className="flex flex-wrap gap-1.5" aria-label="Topics in this section">
                {courseFor(prefs.exam, prefs.section).topics.map((topic) => (
                  <li key={topic} className="rounded-full bg-cobalt-soft px-3 py-1 text-[13px] font-semibold text-cobalt">
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-8 h-80 animate-pulse rounded-[28px] bg-white" />
          )}

          <Link href={`/games/${game.id}`} className="btn btn-lime mt-6 w-full py-4 text-lg">
            <PlayIcon className="h-5 w-5" /> Start game
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
