'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/DashboardLayout'
import { CheckIcon, UploadIcon } from '@/components/brand/Icons'
import { apiClient } from '@/lib/api/client'
import { EXAMS, ExamId, SectionId, getExamPrefs, sectionLabel } from '@/lib/exam'
import type { CustomQuestion, Material } from '@/lib/materials'

const LETTERS = 'ABCDE'
const MAX_FILE_BYTES = 4 * 1024 * 1024

function QuestionReview({
  question,
  onChange,
  onRemove,
}: {
  question: CustomQuestion
  onChange: (changes: Partial<Pick<CustomQuestion, 'correct_answer' | 'status'>>) => void
  onRemove: () => void
}) {
  const isApproved = question.status === 'approved'
  return (
    <li className="rounded-[22px] border-2 border-ink bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className={`chip py-0.5 ${isApproved ? 'bg-lime' : 'bg-mist'}`}>{isApproved ? 'In your games' : 'Needs review'}</span>
        {question.origin === 'generated' && <span className="chip bg-cobalt-soft py-0.5 text-cobalt">Written by AI</span>}
      </div>
      {question.passage && <p className="mb-2 whitespace-pre-line text-[15px] text-ink/75">{question.passage}</p>}
      <p className="whitespace-pre-line font-bold">{question.question}</p>

      <fieldset className="mt-3 space-y-1.5">
        <legend className="mb-1 text-sm text-ink/60">
          {question.correct_answer === null ? 'No answer was found. Pick the correct one:' : 'Correct answer (tap to change):'}
        </legend>
        {question.options.map((option, index) => {
          const isAnswer = question.correct_answer === index
          return (
            <button
              key={index}
              onClick={() => onChange({ correct_answer: index })}
              aria-pressed={isAnswer}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 px-3 py-2 text-left text-[15px] ${
                isAnswer ? 'border-ink bg-lime-soft font-bold' : 'border-ink/15 bg-white hover:border-ink/50'
              }`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-ink text-xs font-extrabold">
                {isAnswer ? <CheckIcon className="h-3.5 w-3.5" /> : LETTERS[index]}
              </span>
              <span className="min-w-0 flex-1 break-words">{option}</span>
            </button>
          )
        })}
      </fieldset>

      {question.explanation && <p className="mt-3 text-sm text-ink/65">{question.explanation}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onChange({ status: isApproved ? 'pending' : 'approved' })}
          disabled={question.correct_answer === null}
          className={`btn px-4 py-2 text-sm ${isApproved ? 'btn-paper' : 'btn-lime'}`}
        >
          {isApproved ? 'Take out of games' : 'Approve for games'}
        </button>
        <button onClick={onRemove} className="rounded-2xl px-4 py-2 text-sm font-bold text-ink/60 hover:bg-coral-soft hover:text-ink">
          Delete
        </button>
      </div>
    </li>
  )
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<CustomQuestion[]>([])
  const [exam, setExam] = useState<ExamId>('sat')
  const [section, setSection] = useState<SectionId>('quant')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [generate, setGenerate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMaterials = useCallback(async () => {
    try {
      setMaterials(await apiClient.getMaterials())
    } catch (e) {
      setMaterials([])
      setError(e instanceof Error ? e.message : 'Could not load your material.')
    }
  }, [])

  // Start from the exam and section they last played
  useEffect(() => {
    const prefs = getExamPrefs()
    setExam(prefs.exam)
    setSection(prefs.section)
    loadMaterials()
  }, [loadMaterials])

  const openMaterial = async (id: string) => {
    setOpenId(id)
    setQuestions([])
    try {
      setQuestions(await apiClient.getMaterialQuestions(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load those questions.')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!file && !text.trim()) {
      setError('Choose a file or paste some text first.')
      return
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setError('That file is too large. The limit is 4 MB.')
      return
    }
    setBusy(true)
    try {
      const result = await apiClient.uploadMaterial({ exam, section, name, text, generate, file })
      setName('')
      setText('')
      setFile(null)
      await loadMaterials()
      setOpenId(result.material.id)
      setQuestions(result.questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const updateQuestion = async (id: number, changes: Partial<Pick<CustomQuestion, 'correct_answer' | 'status'>>) => {
    setError(null)
    try {
      const updated = await apiClient.updateCustomQuestion(id, changes)
      setQuestions((current) => current.map((q) => (q.id === id ? updated : q)))
      loadMaterials()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that change.')
    }
  }

  const removeQuestion = async (id: number) => {
    await apiClient.deleteCustomQuestion(id)
    setQuestions((current) => current.filter((q) => q.id !== id))
    loadMaterials()
  }

  const approveAll = async () => {
    if (!openId) return
    await apiClient.approveAllQuestions(openId)
    setQuestions(await apiClient.getMaterialQuestions(openId))
    loadMaterials()
  }

  const removeMaterial = async (id: string) => {
    await apiClient.deleteMaterial(id)
    if (openId === id) setOpenId(null)
    loadMaterials()
  }

  const optionClass = (selected: boolean) =>
    `flex-1 rounded-2xl border-2 border-ink px-3 py-2.5 text-sm font-bold transition-colors ${
      selected ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'
    }`
  const openMaterialInfo = materials?.find((m) => m.id === openId)
  const needsAnswer = questions.filter((q) => q.correct_answer === null).length

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <h1 className="text-5xl font-extrabold tracking-tight">My material</h1>
        <p className="mt-2 max-w-xl text-ink/65">
          Upload a practice test or your notes. We pull the questions out, you check them, and the ones you approve
          show up in your games alongside the official questions. Other students can&rsquo;t see your uploads. To find and
          write questions, the text is sent to our AI provider (Anthropic or OpenRouter) for processing. Only upload material
          you have the right to use.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border-2 border-ink bg-coral-soft px-4 py-3 font-bold">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="space-y-6">
            <form onSubmit={handleUpload} className="glass space-y-5 rounded-[28px] p-6">
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Exam</legend>
                <div className="flex gap-2">
                  {(Object.keys(EXAMS) as ExamId[]).map((id) => (
                    <button key={id} type="button" onClick={() => setExam(id)} aria-pressed={exam === id} className={optionClass(exam === id)}>
                      {EXAMS[id].name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Section</legend>
                <div className="flex gap-2">
                  {(Object.keys(EXAMS[exam].sections) as SectionId[]).map((id) => (
                    <button key={id} type="button" onClick={() => setSection(id)} aria-pressed={section === id} className={optionClass(section === id)}>
                      {EXAMS[exam].sections[id].name}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="material-file" className="mb-2 block text-sm font-bold">
                  PDF or text file
                </label>
                <input
                  id="material-file"
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="field file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-sm file:font-bold file:text-white"
                />
                <p className="mt-1.5 text-sm text-ink/60">Up to 4 MB. Scanned pages without selectable text can&apos;t be read.</p>
              </div>

              <div>
                <label htmlFor="material-text" className="mb-2 block text-sm font-bold">
                  Or paste text
                </label>
                <textarea
                  id="material-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder={'1. If 3x + 2 = 11, what is x?\nA) 1\nB) 2\nC) 3\nD) 4\nAnswer: C'}
                  className="field font-mono text-sm"
                />
              </div>

              <div>
                <label htmlFor="material-name" className="mb-2 block text-sm font-bold">
                  Name
                </label>
                <input
                  id="material-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Practice test 3"
                  className="field"
                />
              </div>

              <label className="flex items-start gap-3 text-[15px]">
                <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
                <span>
                  <span className="font-bold">Also write new questions from this material</span>
                  <span className="block text-sm text-ink/60">Uses AI. Good for notes that have no questions in them.</span>
                </span>
              </label>

              <button type="submit" disabled={busy} className="btn btn-lime w-full py-3.5">
                <UploadIcon className="h-5 w-5" /> {busy ? 'Reading your material...' : 'Upload and find questions'}
              </button>
            </form>

            <section>
              <h2 className="text-xl font-extrabold">Uploaded</h2>
              {materials === null ? (
                <div className="mt-3 h-24 animate-pulse rounded-[22px] bg-white" />
              ) : materials.length === 0 ? (
                <p className="mt-3 rounded-[22px] border-2 border-dashed border-ink/40 p-5 text-ink/60">Nothing yet. Your uploads will be listed here.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {materials.map((material) => (
                    <li key={material.id} className={`flex items-center gap-3 rounded-[22px] border-2 border-ink p-3 ${openId === material.id ? 'bg-lime-soft' : 'bg-white'}`}>
                      <button onClick={() => openMaterial(material.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-extrabold">{material.name}</span>
                        <span className="text-sm text-ink/60">
                          {sectionLabel(material)} · {material.approved_count} of {material.question_count} in your games
                        </span>
                      </button>
                      <button
                        onClick={() => removeMaterial(material.id)}
                        aria-label={`Delete ${material.name}`}
                        className="rounded-xl px-3 py-2 text-sm font-bold text-ink/60 hover:bg-coral-soft hover:text-ink"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-live="polite">
            {openMaterialInfo ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-extrabold">{openMaterialInfo.name}</h2>
                    <p className="text-sm text-ink/60">
                      {questions.length} {questions.length === 1 ? 'question' : 'questions'}
                      {needsAnswer > 0 && ` · ${needsAnswer} still ${needsAnswer === 1 ? 'needs' : 'need'} an answer`}
                    </p>
                  </div>
                  <button onClick={approveAll} disabled={questions.length === 0} className="btn btn-ink px-4 py-2 text-sm">
                    Approve all with answers
                  </button>
                </div>
                <ul className="mt-4 space-y-3">
                  {questions.map((question) => (
                    <QuestionReview
                      key={question.id}
                      question={question}
                      onChange={(changes) => updateQuestion(question.id, changes)}
                      onRemove={() => removeQuestion(question.id)}
                    />
                  ))}
                </ul>
                <Link href="/games" className="btn btn-cobalt mt-6 w-full py-3.5">
                  Play a game with these
                </Link>
              </>
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-ink/40 p-8 text-center text-ink/60">
                <p className="text-lg font-extrabold text-ink">Review happens here</p>
                <p className="mt-1">Upload something, or pick a past upload, to check its questions before they go into your games.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
