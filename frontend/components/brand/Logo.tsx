import Link from 'next/link'

export function Logo({ href = '/', inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`}>
      <LogoMark className="h-8 w-8" inverted={inverted} />
      SATistics
    </Link>
  )
}

/**
 * Four answer bubbles arranged like a gamepad's face buttons, with the
 * correct one filled in: an exam answer sheet that is also a controller.
 */
export function LogoMark({ className = '', inverted = false }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? '#FFFFFF' : '#17171C'
  const ring = inverted ? '#3A33E8' : '#FFFFFF'
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill={tile} />
      <circle cx="16" cy="8.2" r="4.4" fill="#D4F34A" />
      <circle cx="8.2" cy="16" r="3.5" fill="none" stroke={ring} strokeWidth="2.1" />
      <circle cx="23.8" cy="16" r="3.5" fill="none" stroke={ring} strokeWidth="2.1" />
      <circle cx="16" cy="23.8" r="3.5" fill="none" stroke={ring} strokeWidth="2.1" />
    </svg>
  )
}

/** A filled-in answer row from a bubble sheet, used as a decoration */
export function BubbleRow({ className = '', filled = 2 }: { className?: string; filled?: number }) {
  return (
    <svg viewBox="0 0 120 30" className={className} aria-hidden="true">
      {['A', 'B', 'C', 'D'].map((letter, i) => (
        <g key={letter}>
          <circle cx={15 + i * 30} cy="15" r="12" fill={i === filled ? '#3A33E8' : '#FFFFFF'} stroke="#17171C" strokeWidth="2.5" />
          <text x={15 + i * 30} y="15.5" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fontFamily="var(--font-display)" fill={i === filled ? '#FFFFFF' : '#17171C'}>
            {letter}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** A No. 2 test pencil */
export function Pencil({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" className={className} aria-hidden="true">
      <rect x="2" y="3" width="16" height="18" rx="4" fill="#FF6B4A" stroke="#17171C" strokeWidth="2.5" />
      <rect x="18" y="3" width="10" height="18" fill="#ECEAE4" stroke="#17171C" strokeWidth="2.5" />
      <rect x="28" y="3" width="66" height="18" fill="#D4F34A" stroke="#17171C" strokeWidth="2.5" />
      <path d="M28 12h66" stroke="#17171C" strokeWidth="1.5" opacity=".35" />
      <path d="M94 3 L116 12 L94 21Z" fill="#F2D2A9" stroke="#17171C" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M109 9.2 L116 12 L109 14.8Z" fill="#17171C" />
    </svg>
  )
}
