'use client'

import { LANE_COLORS, LANE_LETTERS } from '@/games/subway-surfers/types/game'
import type { SATQuestion } from '@/lib/api/questions'
import { QuestionContent } from '../QuestionContent'
import { LaneChip } from './LaneChip'

const SOURCE_LABELS: Record<string, string> = {
  official: 'Official College Board question',
  ai: 'AI-written practice question',
  practice: 'Built-in practice question',
}

export function sourceLabel(question: SATQuestion): string {
  if (question.source === 'web' || question.source === 'custom') return `From ${question.sourceName}`
  return SOURCE_LABELS[question.source || ''] || ''
}

// An answer choice: a button when it can be clicked, plain text when the game world does the picking
function Choice({ onClick, children, ...props }: { onClick?: () => void; children: React.ReactNode; className: string; style?: React.CSSProperties; 'aria-pressed'?: boolean }) {
  if (!onClick) {
    const { 'aria-pressed': _pressed, ...rest } = props
    return <div {...rest}>{children}</div>
  }
  return (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )
}

export interface AnswerFeedback {
  isCorrect: boolean
  selected: number | null
  correctAnswer: number
}

interface QuestionCardProps {
  question: SATQuestion
  questionNumber: number
  // 0 when the game has no fixed number of questions
  totalQuestions: number
  // The choice currently picked, before it is graded
  activeOption: number | null
  activeLabel: string
  feedback: AnswerFeedback | null
  // Called when a choice is clicked. Leave out for games where the answer is picked in the game world.
  onPick?: (option: number) => void
  // Hints shown so far, and the choices they ruled out
  hints?: string[]
  eliminated?: number[]
  // After a wrong answer: a nudge shown in place of the answer, which stays hidden
  insight?: string | null
}

/**
 * Exam question with its passage and answer choices, scrollable so long
 * questions are never cut off
 */
export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  activeOption,
  activeLabel,
  feedback,
  onPick,
  hints = [],
  eliminated = [],
  insight = null,
}: QuestionCardProps) {
  // With an insight the player gets another try later, so don't show which choice was right
  const revealAnswer = !!feedback && (feedback.isCorrect || !insight)
  return (
    <>
      <div className="flex-none flex items-center gap-2 px-4 pt-3 pb-2 text-xs">
        <span className="flex-none whitespace-nowrap font-bold text-sky-300">
          Question {questionNumber}
          {totalQuestions > 0 && ` of ${totalQuestions}`}
        </span>
        <span className="truncate text-gray-300">{question.skill || question.topic}</span>
        <span className="flex-none ml-auto px-2 py-0.5 rounded bg-white/10 font-bold text-gray-200">
          {question.difficulty.toUpperCase()}
        </span>
      </div>

      <div className="dark-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-2 sm:space-y-3">
        {question.passage && (
          <QuestionContent
            html={question.passageHtml}
            text={question.passage}
            className="game-reading text-[15px] leading-normal sm:text-[17px] sm:leading-[1.6] text-white border-l-2 border-sky-400/60 pl-3"
          />
        )}
        <QuestionContent
          html={question.questionHtml}
          text={question.stem || question.question}
          className="text-[15px] sm:text-[17px] font-semibold leading-snug"
        />

        <div className="space-y-2">
          {question.options.map((option, lane) => {
            const isActive = !feedback && activeOption === lane
            const isCorrect = revealAnswer && feedback?.correctAnswer === lane
            const isWrongPick = feedback && !feedback.isCorrect && feedback.selected === lane
            const isEliminated = eliminated.includes(lane)
            return (
              <Choice
                key={lane}
                onClick={onPick && !feedback && !isEliminated ? () => onPick(lane) : undefined}
                aria-pressed={isActive}
                className={`w-full flex items-center gap-3 text-left rounded-xl px-3 py-1.5 sm:py-2 border-2 transition-colors ${
                  isCorrect
                    ? 'border-green-500 bg-green-500/20'
                    : isWrongPick
                    ? 'border-red-500 bg-red-500/20'
                    : isActive
                    ? 'bg-white/15'
                    : isEliminated
                    ? 'border-transparent bg-white/5 opacity-40 line-through'
                    : `border-transparent bg-white/5 ${onPick ? 'hover:bg-white/10' : ''}`
                }`}
                style={isActive ? { borderColor: LANE_COLORS[lane] } : undefined}
              >
                <LaneChip lane={lane} />
                <QuestionContent html={question.optionsHtml?.[lane]} text={option} className="flex-1 min-w-0 text-[15px] sm:text-base leading-snug break-words" />
                {isActive && <span className="flex-none text-xs font-bold text-gray-200">{activeLabel}</span>}
                {isCorrect && <span className="flex-none text-xs font-bold text-green-400">✓ Correct</span>}
                {isWrongPick && <span className="flex-none text-xs font-bold text-red-400">✗ Yours</span>}
              </Choice>
            )
          })}
        </div>

        {!feedback && hints.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-[15px] leading-snug text-amber-100">
            {hints.map((hint, i) => (
              <li key={i}>
                <span className="font-bold">Hint {i + 1}:</span> {hint}
              </li>
            ))}
          </ul>
        )}

        {feedback && !feedback.isCorrect && insight && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-[15px] leading-relaxed text-amber-100">
            <p className="mb-1 font-bold text-white">Think it over</p>
            <p>{insight}</p>
            <p className="mt-2 text-sm text-amber-200/80">This question will come back so you can try again.</p>
          </div>
        )}

        {feedback && !feedback.isCorrect && !insight && question.explanation && (
          <div className="rounded-xl bg-white/5 p-3 text-[15px] leading-relaxed text-gray-100">
            <p className="font-bold text-white mb-1">Why {LANE_LETTERS[feedback.correctAnswer]} is correct</p>
            <QuestionContent html={question.explanationHtml} text={question.explanation} />
          </div>
        )}
      </div>
    </>
  )
}
