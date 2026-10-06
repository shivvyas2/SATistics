import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { ArrowUpRight } from '@/components/brand/Icons'
import { CREATOR, SITE_URL, creatorPerson, jsonLd } from '@/lib/site'

const TITLE = 'Shiv Vyas (shivvyas), developer of SATistics'
const DESCRIPTION =
  'SATistics was designed and built by Shiv Vyas (shivvyas), a software engineer in New York. See his portfolio at shivvyas.com and connect on LinkedIn.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/developer' },
  openGraph: {
    type: 'profile',
    url: `${SITE_URL}/developer`,
    title: TITLE,
    description: DESCRIPTION,
    firstName: 'Shiv',
    lastName: 'Vyas',
    username: CREATOR.handle,
    images: [{ url: CREATOR.socialImage, width: 1200, height: 630, alt: 'Shiv Vyas, software engineer in New York' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [CREATOR.socialImage] },
}

const STACK = ['Next.js', 'TypeScript', 'Three.js', 'Tailwind CSS', 'FastAPI', 'Supabase', 'Claude AI', 'Vercel']

const BUILT = [
  { title: 'Six arcade games', body: 'Three.js and canvas games where every target carries a real-format SAT or GRE question.' },
  { title: 'An adaptive question engine', body: 'AI-written questions checked against published practice material, weighted toward each player’s weak topics.' },
  { title: 'Lessons and videos', body: 'Concept lessons for all fifteen exam topics, with ranked YouTube lessons pulled in per topic.' },
]

const LINKS = [
  { label: 'shivvyas.com', href: CREATOR.links.website, note: 'Portfolio and projects' },
  { label: 'LinkedIn', href: CREATOR.links.linkedin, note: 'linkedin.com/in/shivvyas' },
  { label: 'GitHub', href: CREATOR.links.github, note: 'github.com/shivvyas2' },
  { label: 'YouTube', href: CREATOR.links.youtube, note: '@ShivVyas' },
]

const profilePage = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  '@id': `${SITE_URL}/developer#page`,
  url: `${SITE_URL}/developer`,
  name: TITLE,
  description: DESCRIPTION,
  mainEntity: creatorPerson,
  about: { '@id': `${SITE_URL}/#app` },
}

export default function DeveloperPage() {
  return (
    <div className="theme-paper paper-blobs overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(profilePage)} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b-2 border-ink py-5">
          <Logo />
          <Link href="/signup" className="btn btn-ink px-4 py-2 text-sm">
            Start free <ArrowUpRight className="h-4 w-4" />
          </Link>
        </header>

        <main>
          <section className="grid items-center gap-10 py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] sm:py-20">
            <div>
              <p className="font-bold text-cobalt">The developer behind SATistics</p>
              <h1 className="mt-2 text-[clamp(3rem,8vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.04em]">
                Shiv Vyas
                <span className="mt-2 block font-serif text-[0.55em] font-normal italic tracking-normal text-ink/70">aka shivvyas</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/75">
                I&apos;m a software engineer in New York building web, iOS and AI applications. I made SATistics so test prep
                would feel like something you want to come back to, not something you push through.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={CREATOR.links.website} rel="me author" className="btn btn-lime">
                  Visit shivvyas.com <ArrowUpRight className="h-4 w-4" />
                </a>
                <a href={CREATOR.links.linkedin} rel="me noopener" target="_blank" className="btn btn-paper">
                  Connect on LinkedIn
                </a>
              </div>
            </div>
            <figure className="relative mx-auto w-full max-w-sm">
              <div className="brutal relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-brutal-lg">
                <Image src={CREATOR.photo} alt="Shiv Vyas" fill priority sizes="(min-width: 768px) 384px, 90vw" className="object-cover" />
              </div>
              <figcaption className="glass absolute -bottom-5 -left-4 rounded-2xl px-4 py-2 text-sm font-bold">
                {CREATOR.role}
              </figcaption>
            </figure>
          </section>

          <section className="grid items-center gap-10 pb-16 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <figure className="relative mx-auto w-full max-w-xs">
              <div className="brutal relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-brutal-lg">
                <Image
                  src="/team/vighanesh-gaund.jpg"
                  alt="Vighanesh Gaund"
                  fill
                  sizes="(min-width: 768px) 320px, 90vw"
                  className="object-cover"
                />
              </div>
            </figure>
            <div>
              <p className="font-bold text-cobalt">Also building SATistics</p>
              <h2 className="mt-2 text-[clamp(2.25rem,6vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.03em]">
                Vighanesh Gaund
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/75">
                Vighanesh is a developer on SATistics, working alongside Shiv to build the games, lessons and question
                engine.
              </p>
            </div>
          </section>

          <section className="rounded-[32px] border-2 border-ink bg-mist/70 p-5 sm:p-10">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight">What we built here</h2>
                <ul className="mt-6 space-y-4">
                  {BUILT.map((item) => (
                    <li key={item.title}>
                      <h3 className="text-lg font-extrabold">{item.title}</h3>
                      <p className="text-ink/70">{item.body}</p>
                    </li>
                  ))}
                </ul>
                <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tech stack">
                  {STACK.map((tech) => (
                    <li key={tech} className="chip bg-white text-[13px]">
                      {tech}
                    </li>
                  ))}
                </ul>
              </div>
              <a href={CREATOR.links.website} rel="author" className="group block">
                <div className="brutal relative aspect-[4/3] overflow-hidden rounded-[24px] bg-white">
                  <Image
                    src={CREATOR.projectImage}
                    alt="SATistics on Shiv Vyas’s portfolio"
                    fill
                    sizes="(min-width: 768px) 480px, 90vw"
                    className="object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </div>
                <p className="mt-3 text-sm font-bold">See SATistics and more projects on shivvyas.com</p>
              </a>
            </div>
          </section>

          <section className="py-16">
            <h2 className="text-4xl font-extrabold tracking-tight">Find me online</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    rel="me noopener"
                    target={link.href === CREATOR.links.website ? undefined : '_blank'}
                    className="group flex items-center justify-between gap-4 rounded-[22px] border-2 border-ink bg-white p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <span>
                      <span className="block text-xl font-extrabold">{link.label}</span>
                      <span className="text-sm text-ink/60">{link.note}</span>
                    </span>
                    <span className="arrow-btn h-10 w-10 bg-lime group-hover:rotate-45">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="flex flex-col justify-between gap-2 border-t-2 border-ink py-6 text-sm text-ink/60 sm:flex-row">
          <span>
            SATistics by{' '}
            <a href={CREATOR.links.website} rel="author" className="font-bold text-ink">
              Shiv Vyas
            </a>{' '}
            and Vighanesh Gaund
          </span>
          <Link href="/" className="font-bold text-ink">
            Back to SATistics
          </Link>
        </footer>
      </div>
    </div>
  )
}
