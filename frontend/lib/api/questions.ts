/**
 * Question fetching utility
 * Fetches real exam questions from the backend AI agent for the selected
 * exam section, or falls back to the built-in practice set
 */

import { apiClient } from './client'
import { ExamId, Pace, SectionId, gamePace, getExamPrefs, sectionLabel } from '../exam'
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
  try {
    console.log(`🤖 Fetching ${limit} ${sectionLabel({ exam, section })} questions...`)
    
    const response = await apiClient.getAIQuestions(limit, true, exam, section, pace)
    
    if (response.questions && response.questions.length > 0) {
      console.log(`✅ Got ${response.questions.length} questions!`)
      return response.questions
    }
    
    throw new Error('No questions returned from AI')
  } catch (error) {
    console.warn('⚠️ AI questions unavailable, using fallback:', error)
    const bank = getBankQuestions(exam, section, pace)
    return bank.length > 0 ? bank : fallbackQuestions || []
  }
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
