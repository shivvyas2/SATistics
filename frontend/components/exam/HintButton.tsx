'use client'

interface HintButtonProps {
  hintsShown: number
  disabled: boolean
  onClick: () => void
}

// Asks for the next hint. The first is a strategy tip; later ones rule out wrong choices.
export function HintButton({ hintsShown, disabled, onClick }: HintButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-none rounded-xl border border-amber-300/60 bg-amber-300/15 px-3 py-2 text-sm font-bold text-amber-200 hover:bg-amber-300/25 disabled:opacity-40"
    >
      {hintsShown === 0 ? 'Hint' : 'Another hint'}
    </button>
  )
}
