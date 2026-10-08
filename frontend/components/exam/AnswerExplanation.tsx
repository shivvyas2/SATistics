'use client'

import type { SATQuestion } from '@/lib/api/questions'
import { QuestionContent } from '../QuestionContent'

const LETTERS = 'ABCDE'

interface AnswerExplanationProps {
  question: SATQuestion
  // The option the player picked; null when time ran out
  selected: number | null
  // Class for the secondary text, so the block fits light and dark screens
  mutedClassName?: string
}

/**
 * Why the player's wrong pick is wrong, then the worked solution to the correct answer
 */
export function AnswerExplanation({ question, selected, mutedClassName = 'text-ink/70' }: AnswerExplanationProps) {
  const correctLetter = LETTERS[question.correctAnswer]
  const whyWrong = selected !== null && selected !== question.correctAnswer ? question.optionExplanations?.[selected] : ''

  return (
    <div className="space-y-3">
      {whyWrong && (
        <div>
          <h4 className="text-sm font-extrabold">Why {LETTERS[selected!]} is wrong</h4>
          <p className={`mt-1 ${mutedClassName}`}>{whyWrong}</p>
        </div>
      )}
      <div>
        <h4 className="text-sm font-extrabold">How to get {correctLetter}</h4>
        {question.explanation ? (
          <QuestionContent html={question.explanationHtml} text={question.explanation} className={`mt-1 ${mutedClassName}`} />
        ) : (
          <p className={`mt-1 ${mutedClassName}`}>This question came without a worked explanation.</p>
        )}
      </div>
    </div>
  )
}
