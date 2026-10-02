'use client'

import Link from 'next/link'

interface PauseMenuProps {
  gameId: string
  onResume: () => void
  children?: React.ReactNode
}

/**
 * Pause screen with the ways out of a game: resume, restart, change setup, or leave
 */
export function PauseMenu({ gameId, onResume, children }: PauseMenuProps) {
  const itemClass = 'block w-full rounded-xl py-3 text-center font-bold transition-colors'
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-xs text-center text-white">
        <p className="mb-1 font-serif text-4xl italic">Paused</p>
        <p className="mb-5 text-sm text-gray-300">The clock is stopped and the question is hidden.</p>
        <div className="space-y-2">
          <button onClick={onResume} className={`${itemClass} bg-lime text-ink hover:brightness-95`}>
            Resume
          </button>
          <button onClick={() => window.location.reload()} className={`${itemClass} bg-white/10 hover:bg-white/20`}>
            Restart
          </button>
          <Link href={`/games/${gameId}/select`} className={`${itemClass} bg-white/10 hover:bg-white/20`}>
            Change exam or section
          </Link>
          <Link href="/games" className={`${itemClass} bg-white/10 hover:bg-white/20`}>
            Exit to games
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
