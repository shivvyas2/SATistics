/**
 * Exam practice settings
 * Which exam and section the player is training for, and the real exams' pacing
 */

export type ExamId = 'sat' | 'gre'
export type SectionId = 'quant' | 'verbal'
// quick: short questions for fast games. deep: passages and multi-step problems for slow ones
export type Pace = 'quick' | 'deep'

export interface ExamPrefs {
  exam: ExamId
  section: SectionId
  questionCount: number
}

interface SectionInfo {
  name: string
  // Official section length divided by its question count
  secondsPerQuestion: number
  pacing: string
}

export const EXAMS: Record<ExamId, { name: string; sections: Record<SectionId, SectionInfo> }> = {
  sat: {
    name: 'SAT',
    sections: {
      quant: { name: 'Math', secondsPerQuestion: 95, pacing: '22 questions in 35 min' },
      verbal: { name: 'Reading & Writing', secondsPerQuestion: 71, pacing: '27 questions in 32 min' },
    },
  },
  gre: {
    name: 'GRE',
    sections: {
      quant: { name: 'Quantitative', secondsPerQuestion: 105, pacing: '12 questions in 21 min' },
      verbal: { name: 'Verbal', secondsPerQuestion: 90, pacing: '12 questions in 18 min' },
    },
  },
}

export const QUESTION_COUNTS = [6, 10, 20]

// Seconds per question in quick-fire games, which use short questions
export const QUICK_SECONDS_PER_QUESTION = 35

const DEEP_GAMES = ['squid-game']

export function gamePace(gameId: string): Pace {
  return DEEP_GAMES.includes(gameId) ? 'deep' : 'quick'
}

const DEFAULT_PREFS: ExamPrefs = { exam: 'sat', section: 'quant', questionCount: 10 }
const STORAGE_KEY = 'exam_prefs'

export function getExamPrefs(): ExamPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      exam: saved.exam in EXAMS ? saved.exam : DEFAULT_PREFS.exam,
      section: saved.section === 'verbal' ? 'verbal' : saved.section === 'quant' ? 'quant' : DEFAULT_PREFS.section,
      questionCount: QUESTION_COUNTS.includes(saved.questionCount) ? saved.questionCount : DEFAULT_PREFS.questionCount,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function setExamPrefs(prefs: ExamPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage might be unavailable, ignore
  }
}

export function sectionLabel(prefs: Pick<ExamPrefs, 'exam' | 'section'>): string {
  return `${EXAMS[prefs.exam].name} ${EXAMS[prefs.exam].sections[prefs.section].name}`
}
