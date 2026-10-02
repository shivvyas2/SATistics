import type { ExamId, SectionId } from './exam'

// Study material a user uploaded
export interface Material {
  id: string
  name: string
  exam: ExamId
  section: SectionId
  created_at: string
  question_count?: number
  approved_count?: number
}

// A question pulled out of uploaded material
export interface CustomQuestion {
  id: number
  material_id: string
  question: string
  passage: string
  options: string[]
  // null until an answer is found in the material or picked during review
  correct_answer: number | null
  explanation: string
  // extracted: copied from the material. generated: written by AI from the material
  origin: 'extracted' | 'generated'
  // Only approved questions appear in games
  status: 'pending' | 'approved'
}
