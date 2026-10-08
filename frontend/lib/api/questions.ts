/**
 * Question fetching utility
 * Fetches real exam questions from the backend AI agent for the selected
 * exam section, or falls back to the built-in practice set
 */

import { apiClient } from './client'
import { ExamId, Pace, SectionId, gamePace, getExamPrefs } from '../exam'
import { getBankQuestions } from '../questionBank'

export interface SATQuestion {
  id: number
  // Full plain text, including any passage
  question: string
  options: string[]
  correctAnswer: number
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  explanation: string
  exam?: ExamId
  section?: SectionId
  skill?: string
  passage?: string
  // Question without its passage
  stem?: string
  // Sanitized HTML/MathML versions, present on official questions
  questionHtml?: string
  passageHtml?: string
  optionsHtml?: string[]
  explanationHtml?: string
  // Why each option is wrong, in option order ("" for the correct one), when the source has it
  optionExplanations?: string[]
  // Set instead of the text on saved reviews of official questions, which aren't stored
  optionCount?: number
  // official, web, ai, or practice
  source?: string
  sourceName?: string
  sourceUrl?: string
}

/**
 * Fetch personalized questions for the selected exam section
 * Falls back to the built-in practice set if the backend is unavailable
 */
export async function fetchAIQuestions(
  limit: number = 50,
  fallbackQuestions?: SATQuestion[],
  pace?: Pace
): Promise<SATQuestion[]> {
  const { exam, section } = getExamPrefs()
  let questions: SATQuestion[] = []
  try {
    const response = await apiClient.getAIQuestions(limit, true, exam, section, pace)
    questions = response.questions ?? []
  } catch (error) {
    console.warn('⚠️ Questions unavailable, using the built-in set:', error)
  }

  const missing = limit - questions.length
  if (missing > 0) {
    // The server doesn't make players wait while new questions are written: it returns what it
    // has, the built-in set fills the gap now, and the shared pool is refilled for next time
    if (apiClient.getToken()) apiClient.refillQuestionPool(exam, section, pace, missing).catch(() => {})
    const have = new Set(questions.map((q) => q.id))
    const bank = getBankQuestions(exam, section, pace).filter((q) => !have.has(q.id))
    questions = [...questions, ...shuffled(bank).slice(0, missing)]
  }
  return questions.length > 0 ? questions : fallbackQuestions || []
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Fetch questions with caching
 * Useful for games that need persistent questions across restarts
 */
export async function fetchQuestionsWithCache(
  gameId: string,
  limit: number = 50,
  fallbackQuestions?: SATQuestion[]
): Promise<SATQuestion[]> {
  const { exam, section } = getExamPrefs()
  const cacheKey = `ai_questions_${gameId}_${exam}_${section}`
  
  // Check cache first (valid for 5 minutes)
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    try {
      const { questions, timestamp } = JSON.parse(cached)
      const age = Date.now() - timestamp
      if (age < 5 * 60 * 1000) { // 5 minutes
        console.log(`📦 Using cached questions (${Math.floor(age / 1000)}s old)`)
        return questions
      }
    } catch (e) {
      // Invalid cache, continue to fetch
    }
  }
  
  // Fetch fresh questions
  const questions = await fetchAIQuestions(limit, fallbackQuestions, gamePace(gameId))
  
  // Cache them
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      questions,
      timestamp: Date.now()
    }))
  } catch (e) {
    // Storage might be full, ignore
  }
  
  return questions
}
