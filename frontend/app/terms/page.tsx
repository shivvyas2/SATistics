import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactEmail, LegalPageShell } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'The terms for using SATistics.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms and Conditions" updated="October 8, 2026">
      <section>
        <p>
          By creating an account or using SATistics you agree to these Terms and Conditions and to our{' '}
          <Link href="/privacy" className="font-bold underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>Eligibility</h2>
        <p>You must be 13 or older to create an account.</p>
      </section>

      <section>
        <h2>What SATistics is, and isn&rsquo;t</h2>
        <p>
          SATistics is a free practice tool. It is not affiliated with or endorsed by the College Board or ETS, and it
          doesn&rsquo;t guarantee any score. AI-written questions and explanations are checked automatically but can still
          contain mistakes; if something looks wrong, trust the official materials.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          Keep your password to yourself and use SATistics only for your own studying. Don&rsquo;t try to break, overload or
          scrape the service, or get into other people&rsquo;s accounts.
        </p>
      </section>

      <section>
        <h2>Material you upload</h2>
        <p>
          Only upload material you own or have permission to use. You keep your rights in it, and you let us store and
          process it, including with our AI provider, to make practice questions for you. Your uploads are not shown to other
          users.
        </p>
      </section>

      <section>
        <h2>Copyright complaints</h2>
        <p>
          If you believe content on SATistics infringes your copyright, send a notice to <ContactEmail /> identifying the
          work, where it appears on SATistics, and how to reach you. We will remove infringing content and may close accounts
          of repeat infringers.
        </p>
      </section>

      <section>
        <h2>Third-party content</h2>
        <p>
          Some questions come from the College Board question bank or other websites and stay their owners&rsquo;. Games use
          3D models under Creative Commons licences, credited on the{' '}
          <Link href="/credits" className="font-bold underline underline-offset-2">credits page</Link>. Lesson videos are
          provided by YouTube under the{' '}
          <a href="https://www.youtube.com/t/terms" className="underline underline-offset-2">YouTube Terms of Service</a>.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          SATistics is provided as is, without warranties of any kind. To the extent the law allows, we are not liable for
          indirect or consequential losses from using it.
        </p>
      </section>

      <section>
        <h2>Ending your account</h2>
        <p>
          You can delete your account at any time from your{' '}
          <Link href="/profile" className="font-bold underline underline-offset-2">Profile</Link>. We may suspend accounts
          that break these terms.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If these terms change, we will update the date above. Questions: <ContactEmail />.
        </p>
      </section>
    </LegalPageShell>
  )
}
