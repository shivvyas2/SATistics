'use client'

import Link from 'next/link'
import { arcadeFontVariable } from '@/lib/arcade'

interface ArcadeFrameProps {
  // Neon accent for panels and buttons
  color: string
  children: React.ReactNode
}

/**
 * Full-screen cabinet for the arcade-style games: pixel font, neon accent and
 * a CRT overlay on top of whatever the game draws
 */
export function ArcadeFrame({ color, children }: ArcadeFrameProps) {
  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden game-hud select-none ${arcadeFontVariable}`}
      style={{ margin: 0, padding: 0, ['--arcade-color' as string]: color }}
    >
      {children}
      <div className="arcade-crt z-[15]" aria-hidden />
    </div>
  )
}

export interface ArcadeStat {
  label: string
  value: React.ReactNode
  color?: string
}

interface ArcadeTopBarProps {
  stats: ArcadeStat[]
  isMuted?: boolean
  onPause: () => void
  onToggleMute?: () => void
}

// Score strip across the top, like an arcade marquee
export function ArcadeTopBar({ stats, isMuted, onPause, onToggleMute }: ArcadeTopBarProps) {
  const buttonClass = 'pointer-events-auto h-9 w-9 flex-none rounded border-2 border-white/40 bg-black/80 text-sm text-white hover:bg-white/20'
  return (
    <div className="flex items-start gap-3 px-3 pt-2 sm:gap-6">
      <button onClick={onPause} aria-label="Pause and menu" className={buttonClass}>
        ☰
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-x-5 gap-y-1 sm:gap-x-10">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="arcade-font text-center">
            <div className="text-[9px] text-red-500 sm:text-[11px]">{label}</div>
            <div className="arcade-glow text-xs sm:text-base" style={{ color: color || '#ffffff' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
      {onToggleMute && (
        <button onClick={onToggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} className={buttonClass}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  )
}

interface ArcadeStartScreenProps {
  title: string
  subtitle: string
  instructions: React.ReactNode[]
  highScore: number
  onStart: () => void
}

// Attract screen shown before a run starts
export function ArcadeStartScreen({ title, subtitle, instructions, highScore, onStart }: ArcadeStartScreenProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4">
      <div className="arcade-panel w-full max-w-md p-6 text-center text-white">
        <p className="arcade-font text-[10px] text-red-500">HI-SCORE {String(highScore).padStart(6, '0')}</p>
        <h1 className="arcade-font arcade-glow mt-3 text-xl leading-relaxed sm:text-2xl" style={{ color: 'var(--arcade-color)' }}>
          {title}
        </h1>
        <p className="mt-2 text-sm text-gray-300">{subtitle}</p>
        <ul className="my-5 space-y-2 text-left text-sm text-gray-100">
          {instructions.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: 'var(--arcade-color)' }}>▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button onClick={onStart} className="arcade-button w-full py-4 text-sm">
          START
        </button>
        <p className="arcade-font arcade-blink mt-4 text-[10px] text-yellow-300">INSERT COIN</p>
        <Link href="/games" className="mt-3 block text-sm text-gray-300 hover:text-white">
          Back to games
        </Link>
      </div>
    </div>
  )
}
