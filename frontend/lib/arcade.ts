import { Press_Start_2P } from 'next/font/google'

// Pixel font for scores, titles and labels in the arcade-style games
const arcadeFont = Press_Start_2P({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-arcade' })

export const arcadeFontVariable = arcadeFont.variable

const highScoreKey = (gameId: string) => `arcade_hi_${gameId}`

export function getHighScore(gameId: string): number {
  try {
    return Number(localStorage.getItem(highScoreKey(gameId))) || 0
  } catch {
    return 0
  }
}

// Stores the score if it beats the saved one; returns the high score either way
export function recordHighScore(gameId: string, score: number): number {
  const best = Math.max(getHighScore(gameId), score)
  try {
    localStorage.setItem(highScoreKey(gameId), String(best))
  } catch {
    // Storage might be unavailable, ignore
  }
  return best
}
