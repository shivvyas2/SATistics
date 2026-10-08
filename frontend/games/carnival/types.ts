import type { SATQuestion as ReviewQuestion } from '@/lib/api/questions'

export interface SATQuestion {
  id: number
  question: string
  options: string[]
  correctAnswer: number
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  explanation: string
}

export interface CarnivalGameState {
  score: number
  correctAnswers: number
  wrongAnswers: number
  currentQuestionIndex: number
  totalQuestions: number
  streak: number
  maxStreak: number
  bulletsRemaining: number
  isGameOver: boolean
}

export interface QuestionAttempt {
  questionId: number
  topic: string
  difficulty: string
  isCorrect: boolean
  timeSpent: number
  // The question as shown and the option picked (null when time ran out), for the review
  question?: ReviewQuestion
  selected?: number | null
}

export interface GameAnalytics {
  gameId: string
  score: number
  accuracy: number
  correctAnswers: number
  wrongAnswers: number
  questionAttempts: QuestionAttempt[]
  topicPerformance: {
    [topic: string]: {
      correct: number
      total: number
      accuracy: number
    }
  }
  streakInfo: {
    maxStreak: number
  }
  averageResponseTime: number
}

