import { LANE_COLORS, LANE_LETTERS } from '@/games/subway-surfers/types/game'

// Colored letter badge for an answer choice
export function LaneChip({ lane, size = 'md' }: { lane: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex-none flex items-center justify-center rounded-full font-black text-white ${
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
      }`}
      style={{ backgroundColor: LANE_COLORS[lane] }}
    >
      {LANE_LETTERS[lane]}
    </span>
  )
}
