import type { SATQuestion } from '@/lib/api/questions'

export interface Game {
  id: string
  name: string
  description: string
  status: 'coming-soon' | 'available'
}

// One color per answer lane, shared by the 3D gates and the HUD
export const LANE_COLORS = ['#3b82f6', '#f59e0b', '#ec4899', '#10b981', '#a855f7']
export const LANE_LETTERS = ['A', 'B', 'C', 'D', 'E']

export type RunnerPhase = 'loading' | 'ready' | 'question' | 'feedback' | 'module-break' | 'done'

export interface RunnerConfig {
  questionCount: number
  secondsPerQuestion: number
}

export interface RunnerHudState {
  phase: RunnerPhase
  loadProgress: number
  score: number
  streak: number
  correctAnswers: number
  wrongAnswers: number
  questionNumber: number
  totalQuestions: number
  module: number
  moduleCount: number
  sectionSecondsLeft: number
  // Time until the runner reaches the answer gates
  gateSecondsLeft: number
  gateSecondsTotal: number
  currentLane: number
  isDiving: boolean
  isPaused: boolean
  isMuted: boolean
}

export interface RunnerFeedback {
  isCorrect: boolean
  selected: number
  correctAnswer: number
  points: number
}

export interface RunnerModuleInfo {
  module: number
  isHarder: boolean
  previousCorrect: number
  previousTotal: number
}

export interface RunnerReviewItem {
  question: SATQuestion
  // null when the section clock ran out before the question was reached
  selected: number | null
  isCorrect: boolean
  timeSpent: number
}
