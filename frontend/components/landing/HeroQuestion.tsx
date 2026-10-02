'use client'

import { useState } from 'react'
import { getBankQuestions } from '@/lib/questionBank'
import { CheckIcon } from '@/components/brand/Icons'

// A real practice question visitors can answer right on the landing page
const SAMPLES = getBankQuestions('sat', 'quant').slice(0, 3)
const LETTERS = ['A', 'B', 'C', 'D']

export function HeroQuestion() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const q = SAMPLES[index]
  const answered = picked !== null

  const next = () => {
    setPicked(null)
    setIndex((i) => (i + 1) % SAMPLES.length)
  }

  return (
    <div className="glass flex h-full flex-col rounded-[28px] p-5 text-left">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="chip border-ink/80 bg-white/70 py-0.5 text-xs">SAT Math: {q.topic}</span>
        <span className="font-semibold text-ink/50">
          {index + 1} of {SAMPLES.length}
        </span>
      </div>
      <p className="mb-4 text-[17px] font-semibold leading-snug">{q.question}</p>
      <div className="grid gap-2" role="group" aria-label="Answer choices">
        {q.options.map((option, i) => {
          const isCorrect = i === q.correctAnswer
          let tone = 'bg-white hover:bg-cobalt-soft'
          if (answered && isCorrect) tone = 'bg-lime'
          else if (answered && i === picked) tone = 'bg-coral text-white'
          else if (answered) tone = 'bg-white/60 text-ink/40'
          return (
            <button
              key={option}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={`flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 text-left text-[15px] font-semibold transition-colors ${tone}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs">
                {answered && isCorrect ? <CheckIcon className="h-3.5 w-3.5" /> : LETTERS[i]}
              </span>
              {option}
            </button>
          )
        })}
      </div>
      <div className="mt-auto pt-4" aria-live="polite">
        {answered ? (
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm leading-snug text-ink/70">
              <span className="font-bold text-ink">{picked === q.correctAnswer ? 'Correct. ' : 'Not quite. '}</span>
              {q.explanation}
            </p>
            <button onClick={next} className="btn btn-ink shrink-0 px-4 py-2 text-sm">
              Next
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink/50">Pick an answer. In a game, this is a zombie, a mole or a gate.</p>
        )}
      </div>
    </div>
  )
}
