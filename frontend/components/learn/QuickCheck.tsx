'use client'

import { useState } from 'react'
import { CheckIcon } from '@/components/brand/Icons'
import type { Lesson } from '@/lib/lessons'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function QuickCheck({ check }: { check: Lesson['check'] }) {
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null

  return (
    <div>
      <p className="text-[17px] font-semibold leading-snug">{check.question}</p>
      <div className="mt-4 grid gap-2" role="group" aria-label="Answer choices">
        {check.options.map((option, i) => {
          const isCorrect = i === check.correctAnswer
          let tone = 'bg-white hover:bg-cobalt-soft'
          if (answered && isCorrect) tone = 'bg-lime'
          else if (answered && i === picked) tone = 'bg-coral text-white'
          else if (answered) tone = 'bg-white/60 text-ink/40'
          return (
            <button
              key={option}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2.5 text-left text-[15px] font-semibold transition-colors ${tone}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs">
                {answered && isCorrect ? <CheckIcon className="h-3.5 w-3.5" /> : LETTERS[i]}
              </span>
              {option}
            </button>
          )
        })}
      </div>
      <div aria-live="polite">
        {answered && (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-xl text-[15px] leading-relaxed text-ink/75">
              <span className="font-bold text-ink">{picked === check.correctAnswer ? 'Correct. ' : 'Not quite. '}</span>
              {check.explanation}
            </p>
            <button onClick={() => setPicked(null)} className="text-sm font-bold text-cobalt underline decoration-2 underline-offset-4">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
