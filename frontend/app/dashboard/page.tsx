'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { GameCover } from '@/components/brand/GameCover'
import { ArrowUpRight, PlayIcon } from '@/components/brand/Icons'
import { apiClient } from '@/lib/api/client'
import { useAccount } from '@/lib/useAccount'
import { COURSES, Course } from '@/lib/courses'
import { EXAMS, ExamId, getExamPrefs, setExamPrefs } from '@/lib/exam'
import { games } from '@/lib/games'
import { gameTitle } from '@/lib/gameMeta'
import { daysUntil } from '@/lib/profile'
import { GameSession, recordsByGame, timeAgo, useRecentSessions } from '@/lib/sessions'
import { lessonHref } from '@/lib/lessons'
import { VideoPlayer, VideoMeta, useTopicVideos } from '@/components/learn/Videos'

interface UserStats {
  total_games_played: number
  total_questions_answered: number
  total_correct: number
  overall_accuracy: number
  favorite_game: string | null
  weak_topics: string[]
  strong_topics: string[]
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export default function DashboardPage() {
  const router = useRouter()
  const { account } = useAccount()
  const [stats, setStats] = useState<UserStats | null>(null)
  const sessions = useRecentSessions(20)

  useEffect(() => {
    apiClient.getUserStats().then(setStats)
  }, [])

  const profile = account?.profile
  const exam: ExamId = profile?.exam ?? 'sat'
  const courses = COURSES.filter((c) => c.exam === exam)
  const firstName = (profile?.display_name || account?.user?.email?.split('@')[0] || '').split(' ')[0]
  const countdown = daysUntil(profile?.test_date ?? null)

  const records = useMemo(() => (sessions ? recordsByGame(sessions) : []), [sessions])
  const played = new Set(records.map((r) => r.gameId))
  const unplayed = games.filter((g) => !played.has(g.id))
  // Suggest the game they come back to most, or a new one to start with
  const isGame = (id: string | null | undefined): id is string => !!id && games.some((g) => g.id === id)
  // Mock exams are saved as sessions too, but they aren't a game to send someone to
  const lastGame = records.find((r) => isGame(r.gameId))?.gameId
  const nextGameId = isGame(stats?.favorite_game) ? stats.favorite_game : lastGame ?? 'whackamole'

  // Topics they miss most, limited to the exam they're studying
  const examTopics = new Set(courses.flatMap((c) => c.topics))
  const focusTopics = (stats?.weak_topics ?? []).filter((t) => examTopics.has(t))
  const focusTopic = focusTopics[0] ?? courses[0].topics[0]

  const practice = (course: Course) => {
    setExamPrefs({ ...getExamPrefs(), exam: course.exam, section: course.section })
    router.push(`/games/${nextGameId}/select`)
  }
  const courseForTopic = (topic: string) => courses.find((c) => c.topics.includes(topic)) ?? courses[0]

  const aside = (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-extrabold">{EXAMS[exam].name} courses</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {courses.map((course, i) => (
            <button
              key={course.title}
              onClick={() => practice(course)}
              className={`flex aspect-[4/5] flex-col justify-between rounded-[22px] border-2 border-ink p-3 text-left transition-transform hover:-translate-y-0.5 ${
                i === 0 ? 'bg-cobalt text-white' : 'bg-lime'
              }`}
            >
              <span className="text-xs font-bold opacity-75">{course.topics.length} topics</span>
              <span className="text-lg font-extrabold leading-tight">{course.title.replace(`${EXAMS[exam].name} `, '')}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-extrabold">Focus topics</h2>
        {focusTopics.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">Play a few games and the topics you miss most will show up here.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {focusTopics.slice(0, 4).map((topic) => (
              <li key={topic} className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-bold leading-tight">{topic}</span>
                <button onClick={() => practice(courseForTopic(topic))} className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white hover:bg-cobalt">
                  Practice
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {unplayed.length > 0 && (
        <section>
          <h2 className="text-xl font-extrabold">Haven&apos;t tried yet</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {unplayed.slice(0, 4).map((g, i) => (
              <Link key={g.id} href={`/games/${g.id}/select`} className="group text-center">
                <GameCover
                  gameId={g.id}
                  showTitle={false}
                  className={`aspect-square border-2 border-ink transition-transform group-hover:-translate-y-0.5 ${i % 3 === 0 ? 'rounded-full' : 'rounded-[22px]'}`}
                />
                <span className="mt-2 block text-sm font-bold">{gameTitle(g.id, g.name)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  return (
    <DashboardLayout aside={aside}>
      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <header>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {greeting()}
            {firstName && `, ${firstName}`}
          </h1>
          <p className="mt-2 text-lg text-ink/65">
            {countdown !== null && countdown >= 0
              ? `${countdown} ${countdown === 1 ? 'day' : 'days'} until your ${EXAMS[exam].name}. `
              : ''}
            {profile ? `Today’s goal is ${profile.daily_minutes} minutes.` : 'Set up your profile to get a daily goal.'}
          </p>
        </header>

        {account?.user && !profile && (
          <Link href="/profile?setup=1" className="mt-6 flex items-center justify-between gap-4 rounded-[24px] border-2 border-ink bg-lime p-5 shadow-brutal">
            <span>
              <span className="block text-lg font-extrabold">Finish your profile</span>
              <span className="text-sm">Pick your exam and target score so games aim at the right questions.</span>
            </span>
            <span className="arrow-btn bg-white">
              <ArrowUpRight />
            </span>
          </Link>
        )}

        {/* Up next */}
        <section className="mt-6 grid overflow-hidden rounded-[28px] border-2 border-ink bg-cobalt-soft shadow-brutal sm:grid-cols-[1fr_180px]">
          <div className="p-6">
            <p className="text-sm font-bold text-cobalt">Up next</p>
            <h2 className="mt-1 text-3xl font-extrabold leading-tight">{focusTopic}</h2>
            <p className="mt-2 text-ink/70">
              {focusTopics.length > 0
                ? `Your weakest ${EXAMS[exam].name} topic right now. One round of ${gameTitle(nextGameId)} will mix it in.`
                : `A good place to start your ${EXAMS[exam].name} prep. One round of ${gameTitle(nextGameId)} takes about ten minutes.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => practice(courseForTopic(focusTopic))} className="btn btn-ink">
                <PlayIcon className="h-4 w-4" /> Play {gameTitle(nextGameId)}
              </button>
              <Link href={lessonHref(exam, focusTopic)} className="btn btn-paper">
                Study the lesson
              </Link>
            </div>
          </div>
          <GameCover gameId={nextGameId} showTitle={false} className="hidden border-l-2 border-ink sm:block" />
        </section>

        {/* Numbers */}
        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            ['Games played', stats ? stats.total_games_played.toLocaleString() : null],
            ['Accuracy', stats ? `${Math.round(stats.overall_accuracy * 100)}%` : null],
            ['Questions', stats ? stats.total_questions_answered.toLocaleString() : null],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[22px] border-2 border-ink bg-white p-4">
              <dt className="text-sm text-ink/60">{label}</dt>
              <dd className="mt-1 text-3xl font-extrabold">{value ?? <span className="inline-block h-8 w-12 animate-pulse rounded bg-ink/10" />}</dd>
            </div>
          ))}
        </dl>

        <RecommendedVideos course={courseForTopic(focusTopic)} topic={focusTopic} />

        {/* Session feed */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-extrabold">Recent sessions</h2>
            <Link href="/stats" className="text-sm font-bold text-cobalt underline decoration-2 underline-offset-4">
              All statistics
            </Link>
          </div>
          {sessions === null ? (
            <div className="mt-4 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-[24px] bg-white" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="mt-4 rounded-[24px] border-2 border-dashed border-ink/30 p-8 text-center">
              <p className="font-bold">No sessions yet.</p>
              <p className="mt-1 text-sm text-ink/60">Finish a game and your score, accuracy and streak show up here.</p>
              <Link href="/games" className="btn btn-lime mt-5 text-sm">
                Browse games
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {sessions.slice(0, 8).map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}

function SessionCard({ session: s }: { session: GameSession }) {
  const accuracy = Math.round(s.accuracy * 100)
  // Tint by how the round went
  const tint = accuracy >= 80 ? 'bg-lime-soft' : accuracy >= 50 ? 'bg-white' : 'bg-coral-soft'
  return (
    <li className={`flex gap-4 rounded-[24px] border-2 border-ink p-4 ${tint}`}>
      <GameCover gameId={s.game_id} showTitle={false} className="aspect-square w-16 shrink-0 rounded-2xl border-2 border-ink" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-extrabold">{gameTitle(s.game_id, s.game_id)}</p>
          <span className="shrink-0 text-xs text-ink/55">{timeAgo(s.created_at)}</span>
        </div>
        <p className="mt-1 text-sm text-ink/70">
          {s.correct_answers} right, {s.wrong_answers} wrong, best streak {s.max_streak}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-ink bg-white">
            <div className="h-full rounded-full bg-cobalt" style={{ width: `${accuracy}%` }} />
          </div>
          <span className="w-24 text-right text-sm font-extrabold">{s.score.toLocaleString()} pts</span>
        </div>
      </div>
    </li>
  )
}

function RecommendedVideos({ course, topic }: { course: Course; topic: string }) {
  const { videos } = useTopicVideos(course.exam, course.section, topic, 3)
  // Video search is best-effort; skip the section rather than show an error on the home page
  if (videos !== null && videos.length === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Watch: {topic}</h2>
        <Link href={lessonHref(course.exam, topic)} className="text-sm font-bold text-cobalt underline decoration-2 underline-offset-4">
          Open the lesson
        </Link>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {(videos ?? [null, null, null]).map((video, i) =>
          video ? (
            <li key={video.id}>
              <VideoPlayer video={video} />
              <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug">{video.title}</p>
              <VideoMeta video={video} />
            </li>
          ) : (
            <li key={i} className="aspect-video animate-pulse rounded-[22px] bg-white" />
          )
        )}
      </ul>
    </section>
  )
}
