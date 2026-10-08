import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactEmail, LegalPageShell } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What SATistics collects, why, who processes it, and how to download or delete your data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="October 8, 2026">
      <section>
        <p>
          SATistics is a free study app for the SAT and GRE. This page explains what we collect, why, who helps us run the
          service, and the choices you have. We don&rsquo;t sell your data, show ads, or use advertising or analytics
          trackers.
        </p>
      </section>

      <section>
        <h2>Who can use SATistics</h2>
        <p>
          You must be 13 or older to create an account, and you confirm this when you sign up. If you believe a child under
          13 has an account, contact us at <ContactEmail /> and we will delete it.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account: your email address and password (stored by our authentication provider, never in plain text).</li>
          <li>Profile: display name, username, exam, target score, test date, daily study goal and avatar color.</li>
          <li>
            Practice: your game scores and, for each question you answer, the topic, difficulty, whether you were right, the
            time taken, the option you picked and the question as it was shown (official College Board questions are stored
            only as their topic and answers).
          </li>
          <li>Uploads: study material you upload and the questions found in or written from it.</li>
          <li>The date you agreed to these terms and confirmed you are 13 or older.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          To run your account, choose questions that fit your weak topics, show your statistics and answer reviews, and keep
          the service secure. Nothing else.
        </p>
      </section>

      <section>
        <h2>Who processes it for us</h2>
        <ul>
          <li>Supabase stores accounts and all the data above.</li>
          <li>Vercel hosts the website and the API.</li>
          <li>
            Anthropic or OpenRouter (an AI provider) receives the text of material you upload, to find and write questions,
            and a summary of your topic accuracy, to write practice questions that target your weak topics. It does not
            receive your email or name.
          </li>
          <li>
            YouTube shows lesson videos through privacy-enhanced embeds. Playing a video is covered by the{' '}
            <a href="https://www.youtube.com/t/terms" className="underline underline-offset-2">YouTube Terms of Service</a> and the{' '}
            <a href="https://policies.google.com/privacy" className="underline underline-offset-2">Google Privacy Policy</a>.
          </li>
        </ul>
        <p>
          To find practice questions we also search the web and read the College Board question bank. Those requests come
          from our server and carry no information about you.
        </p>
      </section>

      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          We use one cookie and browser storage to keep you signed in, and browser storage for preferences such as your exam,
          finished lessons and high scores. There are no tracking cookies.
        </p>
      </section>

      <section>
        <h2>Keeping and deleting your data</h2>
        <p>
          We keep your data while your account exists. On your{' '}
          <Link href="/profile" className="font-bold underline underline-offset-2">Profile</Link> page you can download
          everything we store about you, or delete your account, which permanently removes your account and all of its data.
          You can also delete individual uploads on the materials page.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete or move your data, or to object to how
          it is used. Most of these you can do yourself in the app; for anything else, contact <ContactEmail />.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change this policy, we will update the date above and, for significant changes, tell you in the app.</p>
      </section>
    </LegalPageShell>
  )
}
