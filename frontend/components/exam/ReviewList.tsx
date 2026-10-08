'use client'

import type { QuestionAttempt } from '@/games/whackamole/types'
import type { RunnerReviewItem } from '@/games/subway-surfers/types/game'
import { QuestionContent } from '../QuestionContent'
import { AnswerExplanation } from './AnswerExplanation'
import { LaneChip } from './LaneChip'

const VARIANTS = {
  // Inside the dark results screen at the end of a game
  dark: {
    box: 'rounded-[20px] border border-white/15 bg-white/5 p-4 mb-5',
    item: 'rounded-xl border border-white/15 bg-ink/60',
    summary: 'text-white',
    stem: 'text-white/75',
    body: 'text-white/90',
    muted: 'text-white/70',
    divider: 'border-white/15',
    right: 'text-lime',
    wrong: 'text-coral',
    correctRow: 'bg-lime/15',
  },
  // On light pages, like statistics
  light: {
    box: '',
    item: 'rounded-[18px] border-2 border-ink bg-white',
    summary: 'text-ink',
    stem: 'text-ink/70',
    body: 'text-ink',
    muted: 'text-ink/70',
    divider: 'border-ink/10',
    right: 'text-ink',
    wrong: 'text-ink',
    correctRow: 'bg-lime-soft',
  },
}

// Review items from attempts that carry their question, for games that don't keep their own review
export function reviewFromAttempts(attempts: QuestionAttempt[]): RunnerReviewItem[] {
  return attempts.flatMap((attempt) =>
    attempt.question
      ? [{ question: attempt.question, selected: attempt.selected ?? null, isCorrect: attempt.isCorrect, timeSpent: attempt.timeSpent }]
      : []
  )
}

const LETTERS = 'ABCDE'

// A saved official question: its text stays with the College Board, so the review shows the answers and a link
function OfficialQuestionStub({ index, question, selected, isCorrect, style }: {
  index: number
  question: RunnerReviewItem['question']
  selected: number | null
  isCorrect: boolean
  style: (typeof VARIANTS)[keyof typeof VARIANTS]
}) {
  return (
    <div className={`${style.item} p-3 text-sm ${style.summary}`}>
      <div className="flex items-center gap-2">
        <span className={`flex-none font-bold ${isCorrect ? style.right : style.wrong}`}>
          {isCorrect ? '✓' : '✗'} Q{index + 1}
        </span>
        <span className={style.stem}>Official College Board question{question.skill ? ` · ${question.skill}` : ''}</span>
        <span className={`ml-auto flex-none text-xs ${style.muted}`}>{question.topic}</span>
      </div>
      <p className={`mt-2 ${style.muted}`}>
        {selected === null ? 'Not answered' : `You chose ${LETTERS[selected]}`}
        {question.correctAnswer !== null && question.correctAnswer !== undefined && `; the answer is ${LETTERS[question.correctAnswer]}`}.
        {' '}The question and its explanation are in the{' '}
        <a href={question.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">
          official question bank
        </a>
        .
      </p>
    </div>
  )
}

/**
 * Every question of a game with the player's answer, the correct answer, why a wrong
 * pick is wrong, and the worked solution. Missed questions start open.
 */
export function ReviewList({ review, variant = 'dark' }: { review: RunnerReviewItem[]; variant?: keyof typeof VARIANTS }) {
  if (review.length === 0) return null
  const style = VARIANTS[variant]
  const missed = review.filter((item) => !item.isCorrect).length

  return (
    <div className={style.box}>
      <h3 className={`mb-1 text-sm font-bold ${style.summary}`}>Answers and explanations</h3>
      <p className={`mb-3 text-xs ${style.muted}`}>
        {missed === 0 ? 'All correct. Open any question to see its solution.' : `${missed} missed, opened below with the solution.`}
      </p>
      <div className="space-y-2">
        {review.map(({ question, selected, isCorrect }, index) =>
          !question.options?.length ? (
            <OfficialQuestionStub key={index} index={index} question={question} selected={selected} isCorrect={isCorrect} style={style} />
          ) : (
            <details key={index} className={style.item} open={!isCorrect}>
              <summary className={`flex cursor-pointer items-center gap-2 p-3 text-sm ${style.summary}`}>
                <span className={`flex-none font-bold ${isCorrect ? style.right : style.wrong}`}>
                  {isCorrect ? '✓' : '✗'} Q{index + 1}
                </span>
                <span className={`truncate ${style.stem}`}>{question.stem || question.question}</span>
                <span className={`ml-auto flex-none text-xs ${style.muted}`}>{question.topic}</span>
              </summary>
              <div className={`space-y-3 px-3 pb-3 text-sm ${style.body}`}>
                {question.passage && (
                  <QuestionContent html={question.passageHtml} text={question.passage} className="game-reading text-base leading-relaxed" />
                )}
                <QuestionContent html={question.questionHtml} text={question.stem || question.question} className="font-semibold" />
                <ul className="space-y-1">
                  {question.options.map((option, lane) => (
                    <li
                      key={lane}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1 ${lane === question.correctAnswer ? style.correctRow : ''}`}
                    >
                      <LaneChip lane={lane} size="sm" />
                      <QuestionContent html={question.optionsHtml?.[lane]} text={option} className="min-w-0 flex-1" />
                      {lane === question.correctAnswer && <span className={`flex-none text-xs font-bold ${style.right}`}>Correct answer</span>}
                      {lane === selected && !isCorrect && <span className={`flex-none text-xs font-bold ${style.wrong}`}>Your answer</span>}
                    </li>
                  ))}
                </ul>
                {selected === null && !isCorrect && <p className="text-xs font-bold text-amber-400">Time ran out on this question.</p>}
                <div className={`border-t pt-3 ${style.divider}`}>
                  <AnswerExplanation question={question} selected={selected} mutedClassName={style.muted} />
                </div>
              </div>
            </details>
          )
        )}
      </div>
    </div>
  )
}
