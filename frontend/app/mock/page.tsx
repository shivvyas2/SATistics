'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ClockIcon, PlayIcon } from '@/components/brand/Icons'
import { Calculator } from '@/components/exam/Calculator'
import { QuestionContent } from '@/components/QuestionContent'
import { GameAnalytics } from '@/games/whackamole/types'
import { apiClient } from '@/lib/api/client'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { EXAMS, ExamId, SectionId, getExamPrefs, sectionLabel, setExamPrefs } from '@/lib/exam'

const LETTERS = 'ABCDE'

// Questions per module on the real exams
const MODULE_QUESTIONS: Record<ExamId, Record<SectionId, number>> = {
  sat: { quant: 22, verbal: 27 },
  gre: { quant: 12, verbal: 12 },
}

// Scaled score range of one section, for the rough estimate on the results page
const SCORE_RANGE: Record<ExamId, [number, number]> = { sat: [200, 800], gre: [130, 170] }

type Length = 'quick' | 'module' | 'section'

function questionCount(exam: ExamId, section: SectionId, length: Length): number {
  const perModule = MODULE_QUESTIONS[exam][section]
  return length === 'quick' ? 10 : length === 'module' ? perModule : perModule * 2
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

interface ExamResult {
  questions: SATQuestion[]
  answers: (number | null)[]
  secondsUsed: number
}

// ---------- Setup ----------

function Setup({ onStart, error, loading }: { onStart: (exam: ExamId, section: SectionId, length: Length) => void; error: string | null; loading: boolean }) {
  const [exam, setExam] = useState<ExamId>('sat')
  const [section, setSection] = useState<SectionId>('quant')
  const [length, setLength] = useState<Length>('module')

  useEffect(() => {
    const prefs = getExamPrefs()
    setExam(prefs.exam)
    setSection(prefs.section)
  }, [])

  const optionClass = (selected: boolean) =>
    `flex-1 rounded-2xl border-2 border-ink px-3 py-2.5 text-sm font-bold transition-colors ${
      selected ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'
    }`
  const info = EXAMS[exam].sections[section]
  const count = questionCount(exam, section, length)
  const minutes = Math.round((count * info.secondsPerQuestion) / 60)
  const lengths: { id: Length; label: string }[] = [
    { id: 'quick', label: 'Quick check' },
    { id: 'module', label: 'One module' },
    { id: 'section', label: 'Full section' },
  ]

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <h1 className="text-5xl font-extrabold tracking-tight">
        Mock <span className="font-serif font-normal italic">exam.</span>
      </h1>
      <p className="mt-2 max-w-xl text-ink/65">
        A timed section in the same format as test day: one clock, no feedback until the end, mark questions for
        review and move freely between them. Then a full score report.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border-2 border-ink bg-coral-soft px-4 py-3 font-bold">
          {error}
        </p>
      )}

      <div className="glass mt-8 space-y-6 rounded-[28px] p-6">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Exam</legend>
          <div className="flex gap-2">
            {(Object.keys(EXAMS) as ExamId[]).map((id) => (
              <button key={id} onClick={() => setExam(id)} aria-pressed={exam === id} className={optionClass(exam === id)}>
                {EXAMS[id].name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Section</legend>
          <div className="flex gap-2">
            {(Object.keys(EXAMS[exam].sections) as SectionId[]).map((id) => (
              <button key={id} onClick={() => setSection(id)} aria-pressed={section === id} className={optionClass(section === id)}>
                {EXAMS[exam].sections[id].name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">Length</legend>
          <div className="flex gap-2">
            {lengths.map(({ id, label }) => (
              <button key={id} onClick={() => setLength(id)} aria-pressed={length === id} className={optionClass(length === id)}>
                {label}
                <span className="block text-xs font-normal opacity-75">{questionCount(exam, section, id)} questions</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-4">
          <ClockIcon className="h-6 w-6 flex-none" />
          <p className="text-[15px]">
            <span className="font-extrabold">{count} questions in {minutes} minutes.</span>{' '}
            <span className="text-ink/65">Real pace is {info.pacing}.{section === 'quant' && ' A calculator is provided.'}</span>
          </p>
        </div>

        <p className="text-sm text-ink/60">
          {exam === 'sat'
            ? 'SAT questions are official ones from the College Board question bank.'
            : 'ETS does not publish its GRE questions for reuse, so these come from public practice sets, AI-written questions in the official style, and your own uploaded material.'}
        </p>
      </div>

      <button onClick={() => onStart(exam, section, length)} disabled={loading} className="btn btn-lime mt-6 w-full py-4 text-lg">
        <PlayIcon className="h-5 w-5" /> {loading ? 'Building your exam...' : 'Start the clock'}
      </button>
    </div>
  )
}

// ---------- Exam ----------

function Exam({ title, questions, totalSeconds, showCalculatorButton, onFinish }: {
  title: string
  questions: SATQuestion[]
  totalSeconds: number
  showCalculatorButton: boolean
  onFinish: (answers: (number | null)[], secondsUsed: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const [flagged, setFlagged] = useState<boolean[]>(() => questions.map(() => false))
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [showClock, setShowClock] = useState(true)
  const [showNavigator, setShowNavigator] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  // One clock for the whole section; time running out ends it
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const left = totalSeconds - (Date.now() - startedAt) / 1000
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(timer)
        onFinish(answersRef.current, totalSeconds)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [totalSeconds, onFinish])

  const question = questions[index]
  const unanswered = answers.filter((a) => a === null).length
  const choose = (option: number) => setAnswers((current) => current.map((a, i) => (i === index ? option : a)))
  const toggleFlag = () => setFlagged((current) => current.map((f, i) => (i === index ? !f : f)))
  const isLow = secondsLeft < Math.min(300, totalSeconds * 0.15)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper text-ink">
      {/* Section bar */}
      <header className="flex flex-none items-center gap-3 border-b-2 border-ink bg-ink px-4 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{title}</p>
          <p className="text-xs text-white/65">Question {index + 1} of {questions.length}</p>
        </div>
        <button onClick={() => setShowClock(!showClock)} className="text-center" aria-label={showClock ? 'Hide the clock' : 'Show the clock'}>
          <span className={`block text-2xl font-extrabold tabular-nums ${isLow ? 'text-coral' : ''}`}>
            {showClock ? formatClock(secondsLeft) : '––:––'}
          </span>
          <span className="text-[11px] text-white/60">{showClock ? 'Hide' : 'Show'}</span>
        </button>
        <div className="flex flex-1 justify-end gap-2">
          {showCalculatorButton && (
            <button onClick={() => setShowCalculator(!showCalculator)} className="rounded-xl border-2 border-white/60 px-3 py-1.5 text-sm font-bold hover:bg-white/10">
              Calculator
            </button>
          )}
          <button onClick={() => setConfirming(true)} className="rounded-xl border-2 border-lime bg-lime px-3 py-1.5 text-sm font-bold text-ink">
            Finish
          </button>
        </div>
      </header>

      {/* Question */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto grid max-w-6xl gap-6 p-5 sm:p-8 ${question.passage ? 'lg:grid-cols-2' : 'max-w-3xl'}`}>
          {question.passage && (
            <QuestionContent
              html={question.passageHtml}
              text={question.passage}
              className="rounded-[22px] border-2 border-ink/15 bg-white p-5 text-[17px] leading-relaxed lg:max-h-[70vh] lg:overflow-y-auto"
            />
          )}
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-extrabold text-white">{index + 1}</span>
              <button
                onClick={toggleFlag}
                aria-pressed={flagged[index]}
                className={`chip ${flagged[index] ? 'bg-coral' : 'bg-white hover:bg-coral-soft'}`}
              >
                {flagged[index] ? '⚑ Marked for review' : '⚐ Mark for review'}
              </button>
            </div>
            <QuestionContent html={question.questionHtml} text={question.stem || question.question} className="text-lg font-bold leading-snug" />
            <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Answer choices">
              {question.options.map((option, i) => {
                const isChosen = answers[index] === i
                return (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={isChosen}
                    onClick={() => choose(i)}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[17px] transition-colors ${
                      isChosen ? 'border-ink bg-cobalt-soft shadow-brutal-sm' : 'border-ink/25 bg-white hover:border-ink'
                    }`}
                  >
                    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-ink text-sm font-extrabold ${isChosen ? 'bg-cobalt text-white' : ''}`}>
                      {LETTERS[i]}
                    </span>
                    <QuestionContent html={question.optionsHtml?.[i]} text={option} className="min-w-0 flex-1 break-words" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Navigation bar */}
      <footer className="relative flex flex-none items-center justify-between gap-3 border-t-2 border-ink bg-mist px-4 py-3">
        <button onClick={() => setIndex(index - 1)} disabled={index === 0} className="btn btn-paper px-5 py-2.5">
          Back
        </button>
        <button onClick={() => setShowNavigator(!showNavigator)} aria-expanded={showNavigator} className="chip bg-ink px-4 py-2 text-white">
          Question {index + 1} of {questions.length} {showNavigator ? '▾' : '▴'}
        </button>
        {index < questions.length - 1 ? (
          <button onClick={() => setIndex(index + 1)} className="btn btn-cobalt px-5 py-2.5">
            Next
          </button>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn btn-lime px-5 py-2.5">
            Finish
          </button>
        )}

        {showNavigator && (
          <div className="brutal absolute bottom-full left-1/2 mb-3 w-[min(520px,92vw)] -translate-x-1/2 rounded-[22px] bg-white p-4 shadow-brutal-lg">
            <p className="mb-3 text-sm font-bold">Jump to a question</p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); setShowNavigator(false) }}
                  aria-label={`Question ${i + 1}${answers[i] === null ? ', unanswered' : ', answered'}${flagged[i] ? ', marked for review' : ''}`}
                  className={`relative h-10 rounded-xl border-2 text-sm font-extrabold ${
                    i === index ? 'border-cobalt' : 'border-ink'
                  } ${answers[i] === null ? 'border-dashed bg-white' : 'bg-cobalt-soft'}`}
                >
                  {i + 1}
                  {flagged[i] && <span className="absolute -right-1 -top-2 text-coral" aria-hidden>⚑</span>}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink/60">Filled: answered · Dashed: unanswered · ⚑ marked for review</p>
          </div>
        )}
      </footer>

      {showCalculator && (
        <div className="absolute right-4 top-16 z-10">
          <Calculator onClose={() => setShowCalculator(false)} />
        </div>
      )}

      {confirming && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/60 p-4">
          <div className="brutal w-full max-w-sm rounded-[24px] bg-paper p-6 text-center shadow-brutal-lg">
            <p className="text-2xl font-extrabold">Finish the section?</p>
            <p className="mt-2 text-ink/70">
              {unanswered > 0
                ? `${unanswered} ${unanswered === 1 ? 'question is' : 'questions are'} still unanswered. There is no penalty for guessing.`
                : 'You have answered every question.'}{' '}
              {formatClock(secondsLeft)} left on the clock.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirming(false)} className="btn btn-paper flex-1">
                Keep working
              </button>
              <button onClick={() => onFinish(answers, totalSeconds - secondsLeft)} className="btn btn-lime flex-1">
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Results ----------

function Results({ exam, section, result, onAgain }: { exam: ExamId; section: SectionId; result: ExamResult; onAgain: () => void }) {
  const { questions, answers, secondsUsed } = result
  const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length
  const share = questions.length > 0 ? correct / questions.length : 0
  const [low, high] = SCORE_RANGE[exam]
  // Round to the exam's own step: 10 points on the SAT, 1 on the GRE
  const step = exam === 'sat' ? 10 : 1
  const estimate = Math.round((low + (high - low) * share) / step) * step

  const topics = useMemo(() => {
    const byTopic = new Map<string, { correct: number; total: number }>()
    questions.forEach((q, i) => {
      const entry = byTopic.get(q.topic) ?? { correct: 0, total: 0 }
      entry.total++
      if (answers[i] === q.correctAnswer) entry.correct++
      byTopic.set(q.topic, entry)
    })
    return Array.from(byTopic.entries()).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
  }, [questions, answers])

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8">
      <p className="text-sm font-bold text-cobalt">{sectionLabel({ exam, section })} mock exam</p>
      <h1 className="text-5xl font-extrabold tracking-tight">
        Score <span className="font-serif font-normal italic">report.</span>
      </h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Correct', value: `${correct}/${questions.length}`, className: 'bg-white' },
          { label: 'Accuracy', value: `${Math.round(share * 100)}%`, className: 'bg-lime' },
          { label: 'Estimated score', value: estimate, className: 'bg-cobalt text-white' },
          { label: 'Time used', value: formatClock(secondsUsed), className: 'bg-white' },
        ].map((tile) => (
          <div key={tile.label} className={`rounded-[22px] border-2 border-ink p-4 shadow-brutal-sm ${tile.className}`}>
            <dt className="text-sm opacity-70">{tile.label}</dt>
            <dd className="mt-1 text-4xl font-extrabold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-ink/60">
        The estimated score is a straight-line guide on the {low}–{high} scale. Real scores are equated across test forms and
        depend on which questions you got right, so treat it as a rough marker.
      </p>

      <section className="mt-8 rounded-[24px] border-2 border-ink bg-white p-5">
        <h2 className="text-xl font-extrabold">By topic, weakest first</h2>
        <div className="mt-4 space-y-3">
          {topics.map(([topic, perf]) => (
            <div key={topic} className="flex items-center gap-3">
              <span className="w-44 text-sm font-bold leading-tight">{topic}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-coral-soft">
                <span className="block h-full bg-lime" style={{ width: `${(perf.correct / perf.total) * 100}%` }} />
              </span>
              <span className="w-10 text-right text-sm tabular-nums">{perf.correct}/{perf.total}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold">Review every question</h2>
        <ul className="mt-4 space-y-2">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctAnswer
            return (
              <li key={i}>
                <details className={`rounded-[22px] border-2 border-ink ${isCorrect ? 'bg-white' : 'bg-coral-soft'}`}>
                  <summary className="flex cursor-pointer items-center gap-3 p-4">
                    <span className={`chip flex-none py-0.5 ${isCorrect ? 'bg-lime' : 'bg-coral'}`}>{isCorrect ? 'Right' : answers[i] === null ? 'Skipped' : 'Wrong'}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{i + 1}. {q.stem || q.question}</span>
                    <span className="hidden flex-none text-sm text-ink/55 sm:block">{q.topic}</span>
                  </summary>
                  <div className="space-y-3 border-t-2 border-ink/10 p-4 text-[15px]">
                    {q.passage && <QuestionContent html={q.passageHtml} text={q.passage} className="text-ink/75" />}
                    <QuestionContent html={q.questionHtml} text={q.stem || q.question} className="font-bold" />
                    <ul className="space-y-1.5">
                      {q.options.map((option, o) => (
                        <li key={o} className={`flex items-start gap-2 rounded-xl px-3 py-1.5 ${o === q.correctAnswer ? 'bg-lime-soft font-bold' : ''}`}>
                          <span className="font-extrabold">{LETTERS[o]}.</span>
                          <QuestionContent html={q.optionsHtml?.[o]} text={option} className="min-w-0 flex-1" />
                          {o === q.correctAnswer && <span className="flex-none text-xs">Correct answer</span>}
                          {o === answers[i] && o !== q.correctAnswer && <span className="flex-none text-xs font-bold">Your answer</span>}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && <QuestionContent html={q.explanationHtml} text={q.explanation} className="text-ink/75" />}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={onAgain} className="btn btn-lime">Take another</button>
        <Link href="/stats" className="btn btn-paper">Your statistics</Link>
        <Link href="/learn" className="btn btn-paper">Study the weak topics</Link>
      </div>
    </div>
  )
}

// ---------- Page ----------

export default function MockExamPage() {
  const [setup, setSetup] = useState<{ exam: ExamId; section: SectionId } | null>(null)
  const [questions, setQuestions] = useState<SATQuestion[] | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async (exam: ExamId, section: SectionId, length: Length) => {
    setError(null)
    setLoading(true)
    // The question loader reads the exam and section from the saved preferences
    setExamPrefs({ ...getExamPrefs(), exam, section })
    const loaded = await fetchAIQuestions(questionCount(exam, section, length))
    setLoading(false)
    if (loaded.length === 0) {
      setError('No questions are available for that section right now. Try again in a moment.')
      return
    }
    setSetup({ exam, section })
    setResult(null)
    setQuestions(loaded)
  }

  const finish = useCallback(
    (answers: (number | null)[], secondsUsed: number) => {
      if (!questions || !setup) return
      setResult({ questions, answers, secondsUsed })
      setQuestions(null)

      // Save it alongside game sessions so it feeds statistics and weak topics
      const topicPerformance: GameAnalytics['topicPerformance'] = {}
      let streak = 0
      let maxStreak = 0
      const attempts = questions.map((q, i) => {
        const isCorrect = answers[i] === q.correctAnswer
        const perf = (topicPerformance[q.topic] ||= { correct: 0, total: 0, accuracy: 0 })
        perf.total++
        if (isCorrect) perf.correct++
        perf.accuracy = (perf.correct / perf.total) * 100
        streak = isCorrect ? streak + 1 : 0
        maxStreak = Math.max(maxStreak, streak)
        return { questionId: q.id, topic: q.topic, difficulty: q.difficulty, isCorrect, timeSpent: Math.round((secondsUsed / questions.length) * 1000) }
      })
      const correct = attempts.filter((a) => a.isCorrect).length
      apiClient
        .saveScore('mock-exam', {
          gameId: 'mock-exam',
          score: correct * 100,
          accuracy: (correct / questions.length) * 100,
          correctAnswers: correct,
          wrongAnswers: questions.length - correct,
          questionAttempts: attempts,
          topicPerformance,
          streakInfo: { maxStreak },
          averageResponseTime: Math.round((secondsUsed / questions.length) * 1000),
        } satisfies GameAnalytics)
        .catch((e) => console.error('Error saving mock exam:', e))
    },
    [questions, setup]
  )

  if (questions && setup) {
    const info = EXAMS[setup.exam].sections[setup.section]
    return (
      <Exam
        title={`${sectionLabel(setup)} · Mock exam`}
        questions={questions}
        totalSeconds={questions.length * info.secondsPerQuestion}
        showCalculatorButton={setup.section === 'quant'}
        onFinish={finish}
      />
    )
  }

  return (
    <DashboardLayout>
      {result && setup ? (
        <Results exam={setup.exam} section={setup.section} result={result} onAgain={() => setResult(null)} />
      ) : (
        <Setup onStart={start} error={error} loading={loading} />
      )}
    </DashboardLayout>
  )
}
