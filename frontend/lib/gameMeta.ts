/**
 * Catalogue details for each game: display title, genre and how you answer.
 * Kept apart from lib/games.ts so the game engine's Game type stays unchanged.
 */

export type Genre = 'Action' | 'Arcade' | 'Runner' | 'Survival'

export interface GameMeta {
  title: string
  genre: Genre
  // How a player picks an answer in this game
  answerBy: string
}

export const GAME_META: Record<string, GameMeta> = {
  zombie: { title: 'Zombie Apocalypse', genre: 'Action', answerBy: 'Shoot the zombie wearing the right answer' },
  whackamole: { title: 'Whack-A-Mole', genre: 'Arcade', answerBy: 'Bonk the mole holding the right answer' },
  carnival: { title: 'Balloon Pop', genre: 'Arcade', answerBy: 'Pop the right balloon, three darts a question' },
  'subway-surfers': { title: 'Subway Surfers', genre: 'Runner', answerBy: 'Switch lanes and run through the right gate' },
  'squid-game': { title: 'Squid Game', genre: 'Survival', answerBy: 'Each right answer moves you forward, five misses and you’re out' },
  'pac-man': { title: 'Pac-Man', genre: 'Arcade', answerBy: 'Run the maze and answer questions as they pop up' },
}

export const GENRES: Genre[] = ['Action', 'Arcade', 'Runner', 'Survival']

export function gameTitle(id: string, fallback = 'Game'): string {
  if (id === 'mock-exam') return 'Mock exam'
  return GAME_META[id]?.title ?? fallback
}
