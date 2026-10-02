'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ArrowLeft, ArrowUpRight, CheckIcon, ExpandIcon, PlayIcon, ShrinkIcon } from '@/components/brand/Icons'
import { QuickCheck } from '@/components/learn/QuickCheck'
import { VideoMeta, VideoPlayer, VideoRow, VideosUnavailable, useTopicVideos } from '@/components/learn/Videos'
import { courseFor } from '@/lib/courses'
import { getExamPrefs, setExamPrefs } from '@/lib/exam'
import { LESSONS, Lesson, findLesson, lessonHref } from '@/lib/lessons'
import { lessonId, useLearned } from '@/lib/learnProgress'

export default function LessonPage() {
  const params = useParams()
  const lesson = findLesson(params.exam as string, params.topic as string)

  if (!lesson) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="rounded-[24px] border-2 border-ink bg-coral-soft p-6">
            <p className="text-lg font-extrabold">That lesson doesn&apos;t exist.</p>
            <Link href="/learn" className="mt-2 inline-block font-bold text-cobalt underline decoration-2 underline-offset-4">
              Back to all lessons
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }
  return <LessonView key={lessonId(lesson.exam, lesson.topic)} lesson={lesson} />
}

// Remembered per browser so the video column stays the size the viewer picked
const WIDE_KEY = 'lesson_video_wide'

function useWideVideo() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    try {
      setWide(localStorage.getItem(WIDE_KEY) === '1')
    } catch {
      // Storage unavailable: start narrow
    }
  }, [])
  const toggle = () => {
    setWide(!wide)
    try {
      localStorage.setItem(WIDE_KEY, wide ? '0' : '1')
    } catch {
      // Storage unavailable: the choice lasts for this visit only
    }
  }
  return [wide, toggle] as const
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const router = useRouter()
  const course = courseFor(lesson.exam, lesson.section)
  const { learned, toggle } = useLearned()
  const done = learned.has(lessonId(lesson.exam, lesson.topic))
  const [stepsShown, setStepsShown] = useState(1)
  const [wide, toggleWide] = useWideVideo()

  const courseLessons = LESSONS.filter((l) => l.exam === lesson.exam && l.section === lesson.section)
  const next = courseLessons[courseLessons.indexOf(lesson) + 1]

  const practice = () => {
    setExamPrefs({ ...getExamPrefs(), exam: lesson.exam, section: lesson.section })
    router.push('/games')
  }

  return (
    <DashboardLayout aside={<VideoPanel lesson={lesson} wide={wide} onToggleWide={toggleWide} />} asideWide={wide}>
      <article className="mx-auto max-w-3xl p-5 sm:p-8">
        <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-bold text-ink/60 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {course.title}
        </Link>
        <h1 className="mt-3 text-5xl font-extrabold leading-[0.95] tracking-tight">{lesson.topic}</h1>
        <p className="mt-3 text-lg text-ink/70">{lesson.summary}</p>

        {/* Key ideas */}
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold">Key ideas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {lesson.ideas.map((idea) => (
              <div key={idea.title} className="glass rounded-[22px] p-5">
                <h3 className="font-extrabold">{idea.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink/75">{idea.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Videos inline when there's no side column */}
        <section className="mt-10 xl:hidden">
          <VideoPanel lesson={lesson} />
        </section>

        {/* Worked example, revealed one step at a time */}
        <section className="mt-10 rounded-[28px] border-2 border-ink bg-white p-6 shadow-brutal">
          <h2 className="text-2xl font-extrabold">Worked example</h2>
          <p className="mt-3 text-[17px] font-semibold leading-snug">{lesson.example.prompt}</p>
          <ol className="mt-5 space-y-3">
            {lesson.example.steps.slice(0, stepsShown).map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cobalt-soft text-sm font-extrabold">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          {stepsShown <= lesson.example.steps.length ? (
            <button onClick={() => setStepsShown(stepsShown + 1)} className="btn btn-paper mt-5 py-2 text-sm">
              {stepsShown < lesson.example.steps.length ? 'Show next step' : 'Show answer'}
            </button>
          ) : (
            <p className="mt-5 rounded-2xl border-2 border-ink bg-lime px-4 py-3 font-bold">{lesson.example.answer}</p>
          )}
        </section>

        {/* Traps */}
        <section className="mt-10 rounded-[28px] border-2 border-ink bg-coral-soft p-6">
          <h2 className="text-2xl font-extrabold">Traps that cost points</h2>
          <ul className="mt-4 space-y-2.5">
            {lesson.traps.map((trap) => (
              <li key={trap} className="flex gap-3 leading-relaxed">
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink bg-coral" aria-hidden="true" />
                {trap}
              </li>
            ))}
          </ul>
        </section>

        {/* Quick check */}
        <section className="mt-10 rounded-[28px] border-2 border-ink bg-cobalt-soft p-6">
          <h2 className="mb-4 text-2xl font-extrabold">Quick check</h2>
          <QuickCheck check={lesson.check} />
        </section>

        {/* Wrap up */}
        <section className="mt-10 flex flex-wrap items-center gap-3 border-t-2 border-ink pt-6">
          <button onClick={() => toggle(lessonId(lesson.exam, lesson.topic))} aria-pressed={done} className={`btn ${done ? 'btn-lime' : 'btn-paper'}`}>
            <CheckIcon className="h-4 w-4" /> {done ? 'Learned' : 'Mark as learned'}
          </button>
          <button onClick={practice} className="btn btn-ink">
            <PlayIcon className="h-4 w-4" /> Practice in a game
          </button>
          {next && (
            <Link href={lessonHref(next.exam, next.topic)} className="group ml-auto inline-flex items-center gap-2 font-bold">
              Next: {next.topic}
              <span className="arrow-btn h-9 w-9 bg-white group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </section>
      </article>
    </DashboardLayout>
  )
}

function VideoPanel({ lesson, wide, onToggleWide }: { lesson: Lesson; wide?: boolean; onToggleWide?: () => void }) {
  const { videos, failed } = useTopicVideos(lesson.exam, lesson.section, lesson.topic)
  const [selected, setSelected] = useState(0)
  const [started, setStarted] = useState(false)
  const current = videos?.[selected]

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Watch</h2>
        {onToggleWide && (
          <button
            onClick={onToggleWide}
            aria-pressed={wide}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold hover:bg-lime-soft"
          >
            {wide ? <ShrinkIcon className="h-3.5 w-3.5" /> : <ExpandIcon className="h-3.5 w-3.5" />}
            {wide ? 'Narrow' : 'Wider'}
          </button>
        )}
      </div>
      <div className="mt-4">
        {videos === null ? (
          <div className="space-y-3">
            <div className="aspect-video animate-pulse rounded-[22px] bg-white" />
            <div className="h-16 animate-pulse rounded-2xl bg-white" />
          </div>
        ) : !current ? (
          <VideosUnavailable exam={lesson.exam} topic={lesson.topic} failed={failed} />
        ) : (
          <>
            <VideoPlayer video={current} autoPlay={started} />
            <p className="mt-3 font-bold leading-snug">{current.title}</p>
            <VideoMeta video={current} />
            {videos.length > 1 && (
              <div className="mt-5 space-y-1">
                <p className="mb-2 text-sm font-bold text-ink/60">More on {lesson.topic}</p>
                {videos.map((video, i) =>
                  i === selected ? null : (
                    <VideoRow
                      key={video.id}
                      video={video}
                      onSelect={() => {
                        setSelected(i)
                        setStarted(true)
                      }}
                    />
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
