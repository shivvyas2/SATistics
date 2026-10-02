import Link from 'next/link'
import { Logo, LogoMark, BubbleRow, Pencil } from '@/components/brand/Logo'
import { ArrowUpRight } from '@/components/brand/Icons'
import { GameCover } from '@/components/brand/GameCover'
import { HeroQuestion } from '@/components/landing/HeroQuestion'
import { COURSES } from '@/lib/courses'
import { GAME_META } from '@/lib/gameMeta'
import { games } from '@/lib/games'
import { CREATOR } from '@/lib/site'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const STEPS = [
  {
    title: 'Drafted in the real format',
    body: 'An AI model writes each question to the official spec: the same domains, answer styles and difficulty bands as the actual exam.',
  },
  {
    title: 'Checked against the web',
    body: 'We search and crawl published practice material to compare wording, format and answers, so nothing reads like a made-up quiz.',
  },
  {
    title: 'Aimed at your weak spots',
    body: 'Every answer you give updates your topic accuracy. The next game leans on the topics you miss most.',
  },
]

export default function LandingPage() {
  return (
    <div className="theme-paper paper-blobs overflow-x-hidden">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        {/* Nav */}
        <header className="flex items-center justify-between gap-4 border-b-2 border-ink py-5">
          <Logo />
          <nav aria-label="Sections" className="glass hidden items-center gap-1 rounded-full p-1 md:flex">
            {[
              ['Courses', '#courses'],
              ['How it works', '#how'],
              ['Games', '#games'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden px-2 text-sm font-bold sm:inline">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-ink px-4 py-2 text-sm">
              Start free <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative pb-16 pt-14 text-center sm:pt-20">
          <LogoMark className="absolute left-0 top-12 hidden h-16 w-16 -rotate-12 sm:block" />
          <Pencil className="absolute -top-1 right-2 hidden w-32 rotate-[-16deg] sm:block" />
          <h1 className="mx-auto max-w-5xl text-[clamp(2.6rem,7vw,5.6rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
            Train for the <span className="whitespace-nowrap">SAT &amp; GRE</span>
            <span className="mt-2 block font-serif text-[1.08em] font-normal italic tracking-[-0.01em]">one game at a time.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            Every zombie, mole and balloon carries a real-format exam question. Answer right to win, and your weak topics come back until they aren&apos;t.
          </p>

          <div className="mt-10 flex flex-col items-center justify-between gap-6 text-left sm:flex-row sm:items-end">
            <dl className="grid grid-cols-3 gap-6 text-sm sm:gap-8">
              {[
                ['2', 'exams'],
                ['4', 'courses'],
                [String(games.length), 'games'],
              ].map(([n, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block text-3xl font-extrabold">{n}</span>
                    <span className="text-ink/60">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <Link href="/signup" className="group inline-flex items-center gap-2">
              <span className="rounded-full border-2 border-ink bg-lime-soft px-5 py-2 font-bold">Create your profile</span>
              <span className="arrow-btn bg-lime group-hover:rotate-45">
                <ArrowUpRight />
              </span>
            </Link>
          </div>

          {/* Cover strip with a live question in the middle */}
          <div className="mt-12 grid grid-cols-2 items-center gap-3 sm:gap-4 lg:grid-cols-[1fr_1fr_1.7fr_1fr_1fr]">
            <GameCover gameId="whackamole" showTitle={false} className="brutal hidden aspect-square rounded-[24px] lg:block" />
            <GameCover gameId="zombie" showTitle={false} className="brutal hidden aspect-[3/4] rounded-[24px] lg:block" />
            <div className="col-span-2 min-h-[420px] lg:col-span-1">
              <HeroQuestion />
            </div>
            <GameCover gameId="subway-surfers" showTitle={false} className="brutal aspect-[3/4] rounded-[24px]" />
            <GameCover gameId="carnival" showTitle={false} className="brutal aspect-[3/4] rounded-[24px] lg:aspect-square" />
          </div>
        </section>

        {/* Courses */}
        <section id="courses" className="scroll-mt-6 rounded-[32px] border-2 border-ink bg-mist/70 p-5 sm:p-10">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Four courses</h2>
            <p className="max-w-sm text-ink/70">
              Each course follows the official content domains, so your practice maps one-to-one onto your score report.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COURSES.map((course, i) => {
              const featured = i === 1
              return (
                <Link
                  key={course.title}
                  href={`/signup?exam=${course.exam}`}
                  className={`group flex flex-col rounded-[24px] border-2 p-5 transition-transform hover:-translate-y-1 ${
                    featured ? 'border-ink bg-cobalt text-white' : 'border-cobalt bg-white'
                  }`}
                >
                  <div className={`flex items-start justify-between gap-3 border-b-2 pb-4 ${featured ? 'border-white/25' : 'border-cobalt/25'}`}>
                    <h3 className="text-2xl font-extrabold leading-tight">{course.title}</h3>
                    <span className={`arrow-btn ${featured ? 'bg-lime text-ink' : 'border-cobalt bg-cobalt text-white'} group-hover:rotate-45`}>
                      <ArrowUpRight />
                    </span>
                  </div>
                  <p className={`mt-4 text-[15px] leading-snug ${featured ? 'text-white/80' : 'text-ink/70'}`}>{course.summary}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {course.topics.map((topic) => (
                      <li
                        key={topic}
                        className={`rounded-full px-3 py-1 text-[13px] font-semibold ${featured ? 'bg-white/15' : 'bg-cobalt-soft text-cobalt'}`}
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </Link>
              )
            })}
          </div>
        </section>

        {/* How questions are made */}
        <section id="how" className="scroll-mt-6 py-20">
          <h2 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Where the questions come from
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="glass relative rounded-[24px] p-6 pt-16">
                <span
                  className={`absolute left-6 top-5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink text-sm font-extrabold ${
                    ['bg-lime', 'bg-cobalt text-white', 'bg-coral text-white'][i]
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className="text-xl font-extrabold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-ink/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Games */}
        <section id="games" className="scroll-mt-6">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">The arcade</h2>
            <Link href="/games" className="group inline-flex items-center gap-2 font-bold">
              Browse all games
              <span className="arrow-btn h-9 w-9 bg-white group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {games.map((game) => (
              <li key={game.id}>
                <Link href={`/games/${game.id}/select`} className="group block">
                  <GameCover gameId={game.id} className="brutal aspect-[3/4] rounded-[20px] transition-transform group-hover:-translate-y-1" />
                  <p className="mt-3 text-sm leading-snug text-ink/70">{GAME_META[game.id]?.answerBy}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing */}
        <section className="relative py-24 text-center">
          <BubbleRow filled={1} className="absolute left-[4%] top-10 hidden w-28 -rotate-6 sm:block" />
          <BubbleRow filled={3} className="absolute bottom-14 right-[6%] hidden w-28 rotate-6 sm:block" />
          <p className="mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold leading-[1.05] tracking-tight">
            Keep{' '}
            <span className="inline-block rounded-full border-2 border-lime px-4 font-serif font-normal italic">playing</span>{' '}
            until test day feels like a rerun.
          </p>
          <Link href="/signup" className="btn btn-lime mt-10 px-7 py-4 text-base">
            Create your free profile
          </Link>
        </section>

        <footer className="flex flex-col justify-between gap-4 border-t-2 border-ink py-6 text-sm sm:flex-row sm:items-center">
          <p className="text-ink/60">
            SATistics, built by{' '}
            <Link href="/developer" rel="author" className="font-bold text-ink underline decoration-2 underline-offset-4">
              Shiv Vyas
            </Link>
          </p>
          <nav aria-label="Shiv Vyas" className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
            <a href={CREATOR.links.website} rel="me author" className="hover:text-cobalt">
              shivvyas.com
            </a>
            <a href={CREATOR.links.linkedin} rel="me noopener" target="_blank" className="hover:text-cobalt">
              LinkedIn
            </a>
            <Link href="/developer" className="hover:text-cobalt">
              Developer
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
