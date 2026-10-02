import type { SATQuestion } from '@/lib/api/questions'

export type SquidPhase = 'loading' | 'ready' | 'green' | 'turning' | 'question' | 'feedback' | 'done'

export type SquidOutcome = 'victory' | 'eliminated' | 'short'

export interface SquidConfig {
  questionCount: number
  secondsPerQuestion: number
}

export interface SquidHudState {
  phase: SquidPhase
  loadProgress: number
  score: number
  lives: number
  maxLives: number
  // Share of the field covered, 0 at the start line and 1 at the finish
  progress: number
  questionNumber: number
  totalQuestions: number
  correctAnswers: number
  questionSecondsLeft: number
  questionSecondsTotal: number
  greenSecondsLeft: number
  greenSecondsTotal: number
  // The answer pad the player is standing on, and how close it is to locking in (0 to 1)
  standingPad: number | null
  lockProgress: number
  // Set while the player is being punished for moving on red
  wasCaughtMoving: boolean
  isPaused: boolean
  isMuted: boolean
}

export interface SquidFeedback {
  isCorrect: boolean
  // null when the question clock ran out
  selected: number | null
  correctAnswer: number
  points: number
  // The question was missed for the first time and will be asked again
  willRetry: boolean
}

export interface SquidReviewItem {
  question: SATQuestion
  selected: number | null
  isCorrect: boolean
  timeSpent: number
}
