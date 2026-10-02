'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ArrowUpRight, CheckIcon } from '@/components/brand/Icons'
import { VideoMeta, VideoPlayer, useTopicVideos } from '@/components/learn/Videos'
import { apiClient } from '@/lib/api/client'
import { useAccount } from '@/lib/useAccount'
import { COURSES } from '@/lib/courses'
import { EXAMS, ExamId } from '@/lib/exam'
import { LESSONS, Lesson, lessonHref } from '@/lib/lessons'
import { lessonId, useLearned } from '@/lib/learnProgress'

export default function LearnPage() {
  const { account } = useAccount()
  const [exam, setExam] = useState<ExamId | null>(null)
  const [stats, setStats] = useState<{ weak: string[]; strong: string[] } | null>(null)
  const { learned } = useLearned()

  // Open on the exam from their profile
  useEffect(() => {
    if (account && exam === null) setExam(account.profile?.exam ?? 'sat')
  }, [account, exam])

  useEffect(() => {
    apiClient.getUserStats().then((s) => setStats({ weak: s?.weak_topics ?? [], strong: s?.strong_topics ?? [] }))
  }, [])

  const activeExam = exam ?? 'sat'
  const lessons = LESSONS.filter((l) => l.exam === activeExam)
  const weak = lessons.filter((l) => stats?.weak.includes(l.topic))
  // Weakest topic first; otherwise the first lesson they haven't finished
  const featured = weak[0] ?? lessons.find((l) => !learned.has(lessonId(l.exam, l.topic))) ?? lessons[0]
  const doneCount = lessons.filter((l) => learned.has(lessonId(l.exam, l.topic))).length

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">Learn</h1>
            <p className="mt-2 max-w-lg text-ink/65">
              Each topic has the key ideas, a worked example, the usual traps and videos. Then a game to lock it in.
            </p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Exam">
            {(Object.keys(EXAMS) as ExamId[]).map((id) => (
              <button
                key={id}
                onClick={() => setExam(id)}
                aria-pressed={activeExam === id}
                className={`chip px-5 py-2 text-base ${activeExam === id ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'}`}
              >
                {EXAMS[id].name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div className="h-full bg-lime transition-[width]" style={{ width: `${(doneCount / lessons.length) * 100}%` }} />
          </div>
          <span className="text-sm font-bold">
            {doneCount} of {lessons.length} learned
          </span>
        </div>

        <FeaturedLesson lesson={featured} isWeak={weak[0] === featured} />

        {COURSES.filter((c) => c.exam === activeExam).map((course) => (
          <section key={course.title} className="mt-12">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-3xl font-extrabold tracking-tight">{course.title}</h2>
              <span className="text-sm text-ink/55">{course.topics.length} topics</span>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {lessons
                .filter((l) => l.section === course.section)
                .map((lesson) => {
                  const done = learned.has(lessonId(lesson.exam, lesson.topic))
                  const status = stats?.weak.includes(lesson.topic) ? 'Needs work' : stats?.strong.includes(lesson.topic) ? 'Strong' : null
                  return (
                    <li key={lesson.topic}>
                      <Link
                        href={lessonHref(lesson.exam, lesson.topic)}
                        className="group flex h-full flex-col rounded-[24px] border-2 border-ink bg-white p-5 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl font-extrabold leading-tight">{lesson.topic}</h3>
                          <span className={`arrow-btn h-9 w-9 ${done ? 'bg-lime' : 'bg-cobalt text-white'} group-hover:rotate-45`}>
                            {done ? <CheckIcon className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </span>
                        </div>
                        <p className="mt-2 text-[15px] leading-snug text-ink/65">{lesson.summary}</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-4 text-[13px] font-bold">
                          <span className="rounded-full bg-mist px-3 py-1">{lesson.ideas.length} key ideas</span>
                          {status && (
                            <span className={`rounded-full px-3 py-1 ${status === 'Strong' ? 'bg-lime-soft' : 'bg-coral-soft'}`}>{status}</span>
                          )}
                          {done && <span className="rounded-full bg-lime px-3 py-1">Learned</span>}
                        </div>
                      </Link>
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
      </div>
    </DashboardLayout>
  )
}

function FeaturedLesson({ lesson, isWeak }: { lesson: Lesson; isWeak: boolean }) {
  const { videos } = useTopicVideos(lesson.exam, lesson.section, lesson.topic, 1)
  const video = videos?.[0]

  return (
    <section className="mt-8 grid overflow-hidden rounded-[28px] border-2 border-ink bg-cobalt text-white shadow-brutal md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col p-6 sm:p-8">
        <p className="text-sm font-bold text-lime">{isWeak ? 'Recommended: your weakest topic' : 'Recommended next'}</p>
        <h2 className="mt-1 text-4xl font-extrabold leading-tight tracking-tight">{lesson.topic}</h2>
        <p className="mt-3 text-white/75">{lesson.summary}</p>
        <Link href={lessonHref(lesson.exam, lesson.topic)} className="btn btn-lime mt-6 self-start">
          Open lesson
        </Link>
      </div>
      <div className="border-t-2 border-ink bg-white p-4 text-ink md:border-l-2 md:border-t-0">
        {video ? (
          <>
            <VideoPlayer video={video} />
            <p className="mt-3 line-clamp-2 font-bold leading-snug">{video.title}</p>
            <VideoMeta video={video} />
          </>
        ) : (
          <div className={`flex aspect-video items-center justify-center rounded-[22px] border-2 border-dashed border-ink/30 p-6 text-center text-sm text-ink/60 ${videos === null ? 'animate-pulse' : ''}`}>
            {videos === null ? 'Finding a video lesson…' : 'Open the lesson for notes, an example and a quick check.'}
          </div>
        )}
      </div>
    </section>
  )
}
