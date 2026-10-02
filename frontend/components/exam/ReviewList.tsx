'use client'

import { useState } from 'react'
import { insightFor } from '@/lib/hints'
import type { RunnerReviewItem } from '@/games/subway-surfers/types/game'
import { QuestionContent } from '../QuestionContent'
import { LaneChip } from './LaneChip'

// End-of-game list of every question with the player's answer and the explanation
export function ReviewList({ review }: { review: RunnerReviewItem[] }) {
  // Answers stay hidden until asked for, so the review can be used to retry
  const [revealed, setRevealed] = useState<number[]>([])

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 mb-5">
      <h3 className="text-white font-bold text-sm mb-3">Question Review</h3>
      <div className="space-y-2">
        {review.map(({ question, selected, isCorrect }, index) => {
          const showAnswer = isCorrect || revealed.includes(index)
          return (
            <details key={index} className="bg-gray-900/60 rounded-lg border border-gray-700">
              <summary className="flex items-center gap-2 p-3 cursor-pointer text-sm text-white">
                <span className={`flex-none font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                  {isCorrect ? '✓' : '✗'} Q{index + 1}
                </span>
                <span className="truncate text-gray-300">{question.stem || question.question}</span>
                <span className="flex-none ml-auto text-xs text-gray-400">{question.topic}</span>
              </summary>
              <div className="px-3 pb-3 text-sm text-gray-200 space-y-3">
                {question.passage && (
                  <QuestionContent html={question.passageHtml} text={question.passage} className="game-reading text-base leading-relaxed text-gray-200" />
                )}
                <QuestionContent html={question.questionHtml} text={question.stem || question.question} />
                <ul className="space-y-1">
                  {question.options.map((option, lane) => (
                    <li key={lane} className="flex items-start gap-2">
                      <LaneChip lane={lane} size="sm" />
                      <QuestionContent html={question.optionsHtml?.[lane]} text={option} className="flex-1 min-w-0" />
                      {showAnswer && lane === question.correctAnswer && <span className="flex-none text-green-400 text-xs font-bold">Correct</span>}
                      {lane === selected && !isCorrect && <span className="flex-none text-red-400 text-xs font-bold">Your answer</span>}
                    </li>
                  ))}
                </ul>
                {selected === null && <p className="text-amber-400 text-xs">Time ran out on this question.</p>}
                {showAnswer ? (
                  question.explanation && (
                    <QuestionContent
                      html={question.explanationHtml}
                      text={question.explanation}
                      className="text-gray-300 border-t border-gray-700 pt-2"
                    />
                  )
                ) : (
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-amber-200">{insightFor(question, selected)}</p>
                    <button
                      onClick={() => setRevealed((current) => [...current, index])}
                      className="mt-2 text-xs font-bold text-sky-300 hover:text-white"
                    >
                      Show the answer and explanation
                    </button>
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
