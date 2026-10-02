'use client'

import { MenuIcon } from '@/components/brand/Icons'

// Dark card for in-game panels. Question cards are styled for a dark background,
// so panels stay ink with the site's thick border and an offset lime shadow.
export const HUD_PANEL = 'pointer-events-auto rounded-[22px] border-2 border-ink bg-ink text-white shadow-[4px_4px_0_0_#D4F34A]'

// Games draw both light and dark scenes, so HUD pieces use the lime offset shadow
const ON_ANY_BACKGROUND = 'border-2 border-ink shadow-[3px_3px_0_0_#D4F34A]'

const TONES = {
  paper: 'bg-mist',
  lime: 'bg-lime',
  cobalt: 'bg-cobalt-soft',
  coral: 'bg-coral-soft',
}

export interface HudStat {
  label: string
  value: React.ReactNode
  tone?: keyof typeof TONES
}

interface GameTopBarProps {
  stats: HudStat[]
  onPause: () => void
}

/** Score chips across the top of the game, with the pause button on the left */
export function GameTopBar({ stats, onPause }: GameTopBarProps) {
  return (
    <div className="flex items-start gap-2 px-3 pt-3 sm:gap-3">
      <button
        onClick={onPause}
        aria-label="Pause and menu"
        className={`pointer-events-auto flex h-11 w-11 flex-none items-center justify-center rounded-full bg-mist text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 ${ON_ANY_BACKGROUND}`}
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className={`mx-auto flex min-w-0 flex-wrap justify-center gap-1.5 rounded-[20px] bg-mist p-1.5 ${ON_ANY_BACKGROUND}`}>
        {stats.map(({ label, value, tone = 'paper' }) => (
          <div key={label} className={`rounded-2xl border-2 border-ink px-3 py-0.5 text-ink ${TONES[tone]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink/55">{label}</div>
            <div className="text-base font-extrabold leading-tight tabular-nums sm:text-lg">{value}</div>
          </div>
        ))}
      </div>
      {/* Balances the pause button so the chips stay centered */}
      <span className="w-11 flex-none" aria-hidden="true" />
    </div>
  )
}

/** Row of filled and empty dots, for lives or shots left */
export function Pips({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="flex items-center gap-1 py-1" aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full border-2 border-ink ${i < filled ? 'bg-ink' : 'bg-transparent'}`} />
      ))}
    </span>
  )
}
