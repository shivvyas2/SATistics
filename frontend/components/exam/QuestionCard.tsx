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
  if (question.source === 'web') return `From ${question.sourceName}`
  return SOURCE_LABELS[question.source || ''] || ''
}

export interface AnswerFeedback {
  isCorrect: boolean
  selected: number | null
  correctAnswer: number
}

interface QuestionCardProps {
  question: SATQuestion
  questionNumber: number
  totalQuestions: number
  // The choice currently picked, before it is graded
  activeOption: number | null
  activeLabel: string
  feedback: AnswerFeedback | null
  onPick: (option: number) => void
}

/**
 * Exam question with its passage and answer choices, scrollable so long
 * questions are never cut off
 */
export function QuestionCard({ question, questionNumber, totalQuestions, activeOption, activeLabel, feedback, onPick }: QuestionCardProps) {
  return (
    <>
      <div className="flex-none flex items-center gap-2 px-4 pt-3 pb-2 text-xs">
        <span className="font-bold text-sky-300">
          Question {questionNumber} of {totalQuestions}
        </span>
        <span className="truncate text-gray-300">{question.skill || question.topic}</span>
        <span className="flex-none ml-auto px-2 py-0.5 rounded bg-white/10 font-bold text-gray-200">
          {question.difficulty.toUpperCase()}
        </span>
      </div>

      <div className="dark-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-3">
        {question.passage && (
          <QuestionContent
            html={question.passageHtml}
            text={question.passage}
            className="game-reading text-[17px] leading-[1.6] text-white border-l-2 border-sky-400/60 pl-3"
          />
        )}
        <QuestionContent
          html={question.questionHtml}
          text={question.stem || question.question}
          className="text-[17px] font-semibold leading-snug"
        />

        <div className="space-y-2">
          {question.options.map((option, lane) => {
            const isActive = !feedback && activeOption === lane
            const isCorrect = feedback?.correctAnswer === lane
            const isWrongPick = feedback && !feedback.isCorrect && feedback.selected === lane
            return (
              <button
                key={lane}
                onClick={() => onPick(lane)}
                disabled={!!feedback}
                aria-pressed={isActive}
                className={`w-full flex items-center gap-3 text-left rounded-xl px-3 py-2 border-2 transition-colors ${
                  isCorrect
                    ? 'border-green-500 bg-green-500/20'
                    : isWrongPick
                    ? 'border-red-500 bg-red-500/20'
                    : isActive
                    ? 'bg-white/15'
                    : 'border-transparent bg-white/5 hover:bg-white/10'
                }`}
                style={isActive ? { borderColor: LANE_COLORS[lane] } : undefined}
              >
                <LaneChip lane={lane} />
                <QuestionContent html={question.optionsHtml?.[lane]} text={option} className="flex-1 min-w-0 text-base leading-snug break-words" />
                {isActive && <span className="flex-none text-xs font-bold text-gray-200">{activeLabel}</span>}
                {isCorrect && <span className="flex-none text-xs font-bold text-green-400">✓ Correct</span>}
                {isWrongPick && <span className="flex-none text-xs font-bold text-red-400">✗ Yours</span>}
              </button>
            )
          })}
        </div>

        {feedback && !feedback.isCorrect && question.explanation && (
          <div className="rounded-xl bg-white/5 p-3 text-[15px] leading-relaxed text-gray-100">
            <p className="font-bold text-white mb-1">Why {LANE_LETTERS[feedback.correctAnswer]} is correct</p>
            <QuestionContent html={question.explanationHtml} text={question.explanation} />
          </div>
        )}
      </div>
    </>
  )
}
