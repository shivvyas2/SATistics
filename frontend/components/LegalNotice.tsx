import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'

const LINK = 'font-bold underline underline-offset-2 hover:text-ink'

// Shown at the foot of every page: legal links, contact, and that the exam owners haven't endorsed this site
export function LegalNotice({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-1.5 text-xs text-ink/55 ${className}`}>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy" className={LINK}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={LINK}>
          Terms and Conditions
        </Link>
        <Link href="/credits" className={LINK}>
          Credits and licences
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          Contact: {CONTACT_EMAIL}
        </a>
      </nav>
      <p>
        SAT® is a trademark registered by the College Board, and GRE® is a registered trademark of ETS. Neither is
        affiliated with or endorses SATistics. Other names and game characters belong to their owners.
      </p>
    </div>
  )
}
