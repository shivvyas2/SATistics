/**
 * Starts downloading a game's code and large files while its questions load, so the game
 * opens from the browser cache instead of waiting for both one after the other.
 */

const GAME_MODULES: Record<string, () => Promise<unknown>> = {
  'squid-game': () => import('@/games/squid-game/SquidGameGame'),
  'subway-surfers': () => import('@/games/subway-surfers/SubwaySurfersGame'),
  'pac-man': () => import('@/games/pac-man/PacManGame'),
  zombie: () => import('@/games/zombie/ZombieGame'),
}

const SQUID = '/games/squid-game/assets'
const GAME_FILES: Record<string, string[]> = {
  'squid-game': [
    `${SQUID}/standingidleplayer.fbx`,
    `${SQUID}/Goofy Running.fbx`,
    `${SQUID}/Dying.fbx`,
    `${SQUID}/red_guy/scene.gltf`,
    `${SQUID}/red_guy/scene.bin`,
    ...['lambert4SG', 'lambert5SG'].flatMap((m) =>
      ['baseColor', 'metallicRoughness', 'normal'].map((t) => `${SQUID}/red_guy/textures/${m}_${t}.jpg`)
    ),
    `${SQUID}/squidgamedoll/scene.gltf`,
    `${SQUID}/squidgamedoll/scene.bin`,
    `${SQUID}/low_poly_dead_tree/scene.gltf`,
    `${SQUID}/low_poly_dead_tree/scene.bin`,
    `${SQUID}/squid-textures/textures/walls_baseColor.png`,
    `${SQUID}/squid-textures/textures/Sand_baseColor.jpeg`,
  ],
  'subway-surfers': [
    '/games/subway-surfers/assets/subway_surfers_maps/scene.gltf',
    '/games/subway-surfers/assets/subway_surfers_maps/scene.bin',
    '/Flying.fbx',
    '/Falling.fbx',
    '/Falling Flat Impact.fbx',
  ],
}

export function preloadGame(gameId: string) {
  GAME_MODULES[gameId]?.().catch(() => {})
  for (const url of GAME_FILES[gameId] ?? []) {
    fetch(encodeURI(url)).catch(() => {})
  }
}
