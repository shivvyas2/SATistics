'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SATQuestion } from '@/lib/api/questions'
import { eliminationHint, strategyHint } from '@/lib/hints'

interface QuestionHints {
  hints: string[]
  eliminated: number[]
  canHint: boolean
  // Shows the next hint; returns the option it rules out, if any
  requestHint: () => number | null
}

/**
 * Hints for the question on screen: first a strategy tip, then wrong choices
 * ruled out one at a time
 */
export function useQuestionHints(question: SATQuestion | null): QuestionHints {
  const [hints, setHints] = useState<string[]>([])
  const [eliminated, setEliminated] = useState<number[]>([])

  useEffect(() => {
    setHints([])
    setEliminated([])
  }, [question])

  const next = question && hints.length > 0 ? eliminationHint(question, eliminated) : null
  const canHint = !!question && (hints.length === 0 || next !== null)

  const requestHint = useCallback(() => {
    if (!question) return null
    if (hints.length === 0) {
      setHints([strategyHint(question)])
      return null
    }
    if (!next) return null
    setHints((current) => [...current, next.text])
    setEliminated((current) => [...current, next.option])
    return next.option
  }, [question, hints.length, next])

  return { hints, eliminated, canHint, requestHint }
}
