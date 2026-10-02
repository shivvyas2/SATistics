import type { SATQuestion } from '@/lib/api/questions'

export type ZombiePhase = 'ready' | 'question' | 'feedback' | 'done'

export interface ZombieConfig {
  questionCount: number
  secondsPerQuestion: number
}

export interface ZombieHudState {
  phase: ZombiePhase
  score: number
  streak: number
  health: number
  maxHealth: number
  questionNumber: number
  totalQuestions: number
  // Time until the zombies reach the player
  secondsLeft: number
  secondsTotal: number
  isPaused: boolean
  isMuted: boolean
}

export interface ZombieFeedback {
  isCorrect: boolean
  // null when the zombies arrived before a shot landed
  selected: number | null
  correctAnswer: number
  points: number
  // The question was missed for the first time and will be asked again
  willRetry: boolean
}

export interface ZombieReviewItem {
  question: SATQuestion
  selected: number | null
  isCorrect: boolean
  timeSpent: number
}
