import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/LegalPageShell'
import { ASSET_CREDITS, LICENSE_URLS } from '@/lib/credits'

export const metadata: Metadata = {
  title: 'Credits and licences',
  description: 'The third-party models, data and trademarks SATistics uses, and the licences they come under.',
  alternates: { canonical: '/credits' },
}

export default function CreditsPage() {
  return (
    <LegalPageShell title="Credits and licences">
      <section>
        <h2>Exam questions</h2>
        <p>
          Questions marked &ldquo;Official College Board question&rdquo; come from the College Board&rsquo;s SAT Suite
          Question Bank and remain the College Board&rsquo;s. Questions marked with another site&rsquo;s name come from that
          site, which the label links to. AI-written questions are generated for SATistics.
        </p>
      </section>

      <section id="bot">
        <h2>SATisticsBot</h2>
        <p>
          To find practice questions, our server reads a few public pages from web search results. It identifies itself as
          SATisticsBot, follows each site&rsquo;s robots.txt, credits and links the page a question came from, and reads only a
          handful of pages per request. To keep it off your site, add <code>User-agent: SATisticsBot</code> and{' '}
          <code>Disallow: /</code> to your robots.txt.
        </p>
      </section>

      <section>
        <h2>3D models</h2>
        <p>These models are used in the games under the Creative Commons licences shown.</p>
        <ul className="!list-none !pl-0 space-y-3">
          {ASSET_CREDITS.map((credit) => (
            <li key={credit.url} className="rounded-[18px] border-2 border-ink bg-white p-4 text-sm">
              This work is based on &ldquo;
              <a href={credit.url} className="font-bold underline underline-offset-2" rel="noopener" target="_blank">
                {credit.title}
              </a>
              &rdquo; by{' '}
              <a href={credit.authorUrl} className="underline underline-offset-2" rel="noopener" target="_blank">
                {credit.author}
              </a>{' '}
              licensed under{' '}
              <a href={LICENSE_URLS[credit.license]} className="underline underline-offset-2" rel="noopener license" target="_blank">
                {credit.license}
              </a>
              . <span className="text-ink/60">Used in {credit.usedIn}.</span>
            </li>
          ))}
        </ul>
      </section>
    </LegalPageShell>
  )
}
