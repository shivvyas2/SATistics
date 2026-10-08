import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { LegalNotice } from '@/components/LegalNotice'
import { CONTACT_EMAIL } from '@/lib/site'

// Shared layout for the credits, privacy and terms pages
export function LegalPageShell({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="theme-paper min-h-screen bg-mist px-4 py-8 sm:px-8">
      <article className="legal-page mx-auto max-w-3xl">
        <Logo href="/" />
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink/60">Last updated {updated}</p>}
        <div className="mt-8 space-y-8 text-ink/80 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <LegalNotice className="mt-12" />
        <p className="mt-6">
          <Link href="/" className="font-bold underline underline-offset-4">
            Back to SATistics
          </Link>
        </p>
      </article>
    </div>
  )
}

// The contact address, or a note that it isn't published yet
export function ContactEmail() {
  if (!CONTACT_EMAIL) return <span>(contact address not yet published)</span>
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  )
}
