/**
 * Third-party 3D models used in the games, with the credit each licence asks for.
 * Copied from the license.txt next to each model; keep the two in sync.
 */

export interface AssetCredit {
  title: string
  url: string
  author: string
  authorUrl: string
  license: 'CC-BY-4.0' | 'CC-BY-NC-SA-4.0'
  usedIn: string
}

export const LICENSE_URLS: Record<AssetCredit['license'], string> = {
  'CC-BY-4.0': 'http://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC-SA-4.0': 'http://creativecommons.org/licenses/by-nc-sa/4.0/',
}

export const ASSET_CREDITS: AssetCredit[] = [
  {
    title: 'Squid Game - Red Light Green Light - Game Room',
    url: 'https://sketchfab.com/3d-models/squid-game-red-light-green-light-game-room-207427ee5a0f403e904c145aeb457195',
    author: 'JohnWick007',
    authorUrl: 'https://sketchfab.com/JohnWick007_',
    license: 'CC-BY-NC-SA-4.0',
    usedIn: 'Red Light, Green Light',
  },
  {
    title: 'squidgamedoll',
    url: 'https://sketchfab.com/3d-models/squidgamedoll-4d6eb3321a2e42d4be1c83a983825e8e',
    author: 'exohakufu',
    authorUrl: 'https://sketchfab.com/exohakufu',
    license: 'CC-BY-4.0',
    usedIn: 'Red Light, Green Light',
  },
  {
    title: 'Squid Game : PinkSoldier Triangle',
    url: 'https://sketchfab.com/3d-models/squid-game-pinksoldier-triangle-b8d9ee104cfa409a800186c3c887a7e0',
    author: 'Jaeyeon Nam',
    authorUrl: 'https://sketchfab.com/jaeysart',
    license: 'CC-BY-4.0',
    usedIn: 'Red Light, Green Light',
  },
  {
    title: 'Squid Game People',
    url: 'https://sketchfab.com/3d-models/squid-game-people-2b158ecbe1734d7e8da813795aef6682',
    author: 'businessyuen',
    authorUrl: 'https://sketchfab.com/businessyuen',
    license: 'CC-BY-4.0',
    usedIn: 'Red Light, Green Light',
  },
  {
    title: 'Low Poly Dead Tree',
    url: 'https://sketchfab.com/3d-models/low-poly-dead-tree-31d4fb51a0744cf6916d90928d5a936e',
    author: 'dvnc.tech',
    authorUrl: 'https://sketchfab.com/dvnc.tech',
    license: 'CC-BY-4.0',
    usedIn: 'Red Light, Green Light',
  },
  {
    title: 'Jake Subway Surfers',
    url: 'https://sketchfab.com/3d-models/jake-subway-surfers-50be24c8b2fe4628a401b339bb2e2958',
    author: 'Raph3D',
    authorUrl: 'https://sketchfab.com/anndaniau',
    license: 'CC-BY-4.0',
    usedIn: 'the runner game',
  },
  {
    title: 'Subway Surfers Maps',
    url: 'https://sketchfab.com/3d-models/subway-surfers-maps-efd4026fe3274204b156198e5c3ea03b',
    author: 'CLfanmodel',
    authorUrl: 'https://sketchfab.com/jamescontreras2001',
    license: 'CC-BY-4.0',
    usedIn: 'the runner game',
  },
]
