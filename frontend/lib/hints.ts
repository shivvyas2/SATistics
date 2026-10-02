/**
 * Hints and insights
 * Nudges a player toward the answer without giving it away
 */

import type { SATQuestion } from './api/questions'

const LETTERS = 'ABCDE'

// Matched against a question's skill and topic, most specific first
// Matched against the question's own wording, which is more specific than its topic
const PROMPT_TIPS: [RegExp, string][] = [
  [/quantity a/i, 'Test different kinds of numbers: zero, one, a fraction, a negative. If the result changes, it cannot be determined.'],
  [/logical and precise word|_{3,}/i, 'Cover the blank and predict your own word from the clues around it, then look for the closest match.'],
  [/logical transition/i, 'Decide how the two ideas relate first: same direction, contrast, cause, or example.'],
  [/conventions of standard english/i, 'Find the subject and its verb, and check whether each side of any punctuation could stand alone as a sentence.'],
]

const STRATEGY_TIPS: [RegExp, string][] = [
  [/words in context|text completion|sentence equivalence|vocabulary/i, 'Cover the blank and predict your own word from the clues around it, then look for the closest match.'],
  [/transition/i, 'Decide how the two ideas relate first: same direction, contrast, cause, or example.'],
  [/boundaries/i, 'Check whether each side of the punctuation could stand alone as a complete sentence.'],
  [/form, structure|conventions/i, 'Find the subject and its verb. They must agree with each other and with the tense of the rest of the text.'],
  [/command of evidence/i, 'Put the claim in your own words, then find the choice that supports exactly that claim.'],
  [/inference/i, 'The answer must follow from the text alone. Reject anything that goes further than what is stated.'],
  [/central ideas/i, 'Sum the text up in one sentence before reading the choices.'],
  [/text structure|purpose/i, 'Ask what the text is doing (describing, arguing, contrasting), not just what it says.'],
  [/cross-text/i, "Sum up each author's view in a few words, then compare them."],
  [/rhetorical synthesis/i, 'The goal stated in the question decides the answer. Pick the choice that does that job and nothing else.'],
  [/reading comprehension|information and ideas|craft and structure/i, 'Go back to the passage. The right answer is backed by specific words in it.'],
  [/expression of ideas/i, 'Read the sentence before and after. The right choice keeps the logic flowing between them.'],
  [/percent|ratio|rate|proportion|data analysis|probability|statistic/i, 'Write down the units and set up the ratio or percent equation before calculating.'],
  [/geometry|trigonometry|triangle|circle|area|volume|angle/i, 'Sketch the figure and label what you know. Look for right triangles and shared sides.'],
  [/nonlinear|quadratic|exponential|advanced math|equivalent expression/i, 'Try rewriting the expression: factor, expand, or plug in a simple number to test the choices.'],
  [/linear|algebra|system|inequalit/i, 'Isolate the variable one step at a time, or plug the answer choices back in.'],
  [/arithmetic|number/i, 'Estimate first. Rounding often rules out most of the choices.'],
]

const DEFAULT_TIP = 'Rule out the choices you know are wrong first, then compare what is left.'
// Rationales that say a choice is wrong without saying why
const UNINFORMATIVE = /may result from|conceptual or calculation error/i

export function strategyHint(question: SATQuestion): string {
  const prompt = PROMPT_TIPS.find(([pattern]) => pattern.test(question.question))
  if (prompt) return prompt[1]
  const subject = `${question.skill || ''} ${question.topic}`
  return STRATEGY_TIPS.find(([pattern]) => pattern.test(subject))?.[1] ?? DEFAULT_TIP
}

/**
 * The part of the question's explanation that says why one choice is wrong,
 * or null if the explanation doesn't address that choice usefully
 */
export function whyNot(question: SATQuestion, option: number): string | null {
  const letter = LETTERS[option]
  const match = question.explanation.match(
    new RegExp(`Choice ${letter} is incorrect\\s*(?:because|\\.|,)?\\s*([\\s\\S]*?)(?=\\s*Choices? [A-E]\\b|$)`)
  )
  const reason = match?.[1]?.trim()
  if (!reason || reason.length < 15 || UNINFORMATIVE.test(reason)) return null
  // Don't let a wrong-choice explanation name the right one
  if (new RegExp(`choice ${LETTERS[question.correctAnswer]}\\b`, 'i').test(reason)) return null
  return reason.charAt(0).toUpperCase() + reason.slice(1)
}

// What to tell a player who picked a wrong answer, without revealing the right one
export function insightFor(question: SATQuestion, selected: number | null): string {
  const reason = selected === null ? null : whyNot(question, selected)
  return reason ? `Why ${LETTERS[selected!]} doesn't work: ${reason}` : strategyHint(question)
}

// A wrong choice to rule out, preferring one whose explanation says why it is wrong
export function eliminationHint(question: SATQuestion, eliminated: number[]): { option: number; text: string } | null {
  const candidates = question.options
    .map((_, option) => option)
    .filter((option) => option !== question.correctAnswer && !eliminated.includes(option))
  // Always leave the right answer and at least one other choice standing
  if (candidates.length <= 1) return null
  const explained = candidates.find((option) => whyNot(question, option))
  const option = explained ?? candidates[Math.floor(Math.random() * candidates.length)]
  const reason = whyNot(question, option)
  return { option, text: reason ? `Rule out ${LETTERS[option]}: ${reason}` : `You can rule out ${LETTERS[option]}.` }
}
