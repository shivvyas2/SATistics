import type { ExamId, SectionId } from '@/lib/exam'

export interface Course {
  exam: ExamId
  section: SectionId
  title: string
  summary: string
  // Official content domains, matching the topic names the question bank uses
  topics: string[]
}

export const COURSES: Course[] = [
  {
    exam: 'sat',
    section: 'quant',
    title: 'SAT Math',
    summary: 'Linear equations to circle theorems, at the Digital SAT’s pace.',
    topics: ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'],
  },
  {
    exam: 'sat',
    section: 'verbal',
    title: 'SAT Reading & Writing',
    summary: 'Short passages, one question each, the way the real test sets them.',
    topics: ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'],
  },
  {
    exam: 'gre',
    section: 'quant',
    title: 'GRE Quant',
    summary: 'Quantitative comparison, data interpretation and multi-step problems.',
    topics: ['Arithmetic', 'Algebra', 'Geometry', 'Data Analysis'],
  },
  {
    exam: 'gre',
    section: 'verbal',
    title: 'GRE Verbal',
    summary: 'Text completion, sentence equivalence and dense academic reading.',
    topics: ['Text Completion', 'Sentence Equivalence', 'Reading Comprehension'],
  },
]

export function courseFor(exam: ExamId, section: SectionId): Course {
  return COURSES.find((c) => c.exam === exam && c.section === section) ?? COURSES[0]
}
