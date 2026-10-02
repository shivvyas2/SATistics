import { GAME_META } from '@/lib/gameMeta'

/**
 * Illustrated cover art for each game, drawn as SVG in the site palette.
 * The art fills its parent; give the parent an aspect ratio.
 */

const INK = '#17171C'
const PAPER = '#ECEAE4'
const LIME = '#D4F34A'
const COBALT = '#3A33E8'
const CORAL = '#FF6B4A'
const PINK = '#F45D9C'

interface CoverStyle {
  bg: string
  art: JSX.Element
}

const letter = (x: number, y: number, ch: string, fill = INK, size = 22) => (
  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={800} fill={fill} fontFamily="var(--font-display)">
    {ch}
  </text>
)

const COVERS: Record<string, CoverStyle> = {
  zombie: {
    bg: INK,
    art: (
      <>
        <circle cx="208" cy="104" r="64" fill={LIME} />
        <circle cx="208" cy="104" r="40" fill="none" stroke={INK} strokeWidth="4" />
        <path d="M208 30v40M208 138v40M134 104h40M242 104h40" stroke={CORAL} strokeWidth="5" strokeLinecap="round" />
        <path d="M0 300 C70 262 150 270 300 286 V400 H0Z" fill={COBALT} />
        {[{ x: 32, l: 'A' }, { x: 214, l: 'C' }].map(({ x, l }) => (
          <g key={l}>
            <path d={`M${x} 302 v-40 a26 26 0 0 1 52 0 v40z`} fill={PAPER} stroke={INK} strokeWidth="3" />
            {letter(x + 26, 270, l)}
          </g>
        ))}
        <g transform="rotate(-8 150 250)">
          <rect x="122" y="214" width="56" height="70" rx="14" fill={LIME} stroke={INK} strokeWidth="4" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={124 + i * 14} y={160 + (i === 1 || i === 2 ? 0 : 12)} width="12" height="62" rx="6" fill={LIME} stroke={INK} strokeWidth="4" />
          ))}
          <rect x="104" y="226" width="30" height="13" rx="6.5" fill={LIME} stroke={INK} strokeWidth="4" />
          <path d="M136 284 l-6 30 h40 l-6 -30" fill={LIME} stroke={INK} strokeWidth="4" />
        </g>
      </>
    ),
  },
  whackamole: {
    bg: LIME,
    art: (
      <>
        <ellipse cx="70" cy="300" rx="50" ry="16" fill={INK} />
        <ellipse cx="236" cy="300" rx="50" ry="16" fill={INK} />
        <ellipse cx="150" cy="262" rx="62" ry="19" fill={INK} />
        <path d="M100 262 V180 a50 50 0 0 1 100 0 V262z" fill={COBALT} stroke={INK} strokeWidth="4" />
        <circle cx="132" cy="180" r="9" fill="white" stroke={INK} strokeWidth="3" />
        <circle cx="168" cy="180" r="9" fill="white" stroke={INK} strokeWidth="3" />
        <circle cx="134" cy="182" r="3.5" fill={INK} />
        <circle cx="170" cy="182" r="3.5" fill={INK} />
        <ellipse cx="150" cy="202" rx="13" ry="9" fill={CORAL} stroke={INK} strokeWidth="3" />
        <g transform="rotate(-6 150 236)">
          <rect x="118" y="214" width="64" height="44" rx="8" fill="white" stroke={INK} strokeWidth="4" />
          {letter(150, 236, 'B', INK, 28)}
        </g>
        <g transform="rotate(-32 236 120)">
          <rect x="228" y="96" width="14" height="120" rx="7" fill={INK} />
          <rect x="196" y="60" width="78" height="44" rx="12" fill={CORAL} stroke={INK} strokeWidth="4" />
        </g>
        <path d="M60 140 l14 8 M48 168 h16 M70 118 l6 14" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  carnival: {
    bg: COBALT,
    art: (
      <>
        {[
          { cx: 70, cy: 120, c: LIME, l: 'A' },
          { cx: 150, cy: 92, c: CORAL, l: 'B' },
          { cx: 230, cy: 128, c: PAPER, l: 'C' },
          { cx: 120, cy: 196, c: PINK, l: 'D' },
        ].map(({ cx, cy, c, l }) => (
          <g key={l}>
            <path d={`M${cx} ${cy + 44} q-14 40 6 76 t-4 70`} fill="none" stroke="white" strokeWidth="2.5" />
            <ellipse cx={cx} cy={cy} rx="36" ry="44" fill={c} stroke={INK} strokeWidth="4" />
            <path d={`M${cx - 6} ${cy + 44} h12 l-6 9z`} fill={c} stroke={INK} strokeWidth="3" />
            <ellipse cx={cx - 14} cy={cy - 18} rx="7" ry="11" fill="white" opacity="0.6" />
            {letter(cx, cy + 4, l, INK, 30)}
          </g>
        ))}
        <g transform="rotate(-28 220 230)">
          <rect x="190" y="226" width="80" height="8" rx="4" fill={INK} />
          <path d="M270 222 l22 8 -22 8z" fill={INK} />
          <path d="M190 222 l-18 -8 v32 l18 -8z" fill={LIME} stroke={INK} strokeWidth="3" />
        </g>
        <path d="M0 268 h300" stroke="white" strokeWidth="3" />
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={i} d={`M${i * 37.5} 268 l18.75 30 l18.75 -30z`} fill={i % 2 ? CORAL : PAPER} stroke={INK} strokeWidth="2.5" />
        ))}
      </>
    ),
  },
  'subway-surfers': {
    bg: CORAL,
    art: (
      <>
        <circle cx="150" cy="112" r="56" fill={LIME} stroke={INK} strokeWidth="4" />
        <path d="M0 150 h300" stroke={INK} strokeWidth="4" />
        <path d="M150 150 L-80 400 M150 150 L20 400 M150 150 L120 400 M150 150 L180 400 M150 150 L280 400 M150 150 L380 400" stroke={INK} strokeWidth="4" />
        {[200, 240, 296].map((y, i) => (
          <path key={y} d={`M${150 - (y - 150) * 1.8} ${y} H${150 + (y - 150) * 1.8}`} stroke={INK} strokeWidth={2 + i} opacity="0.5" />
        ))}
        {[
          { x: 58, c: COBALT, l: 'A' },
          { x: 116, c: LIME, l: 'B' },
          { x: 184, c: PAPER, l: 'C' },
          { x: 242, c: PINK, l: 'D' },
        ].map(({ x, c, l }) => (
          <g key={l}>
            <path d={`M${x - 24} 254 v-38 a24 24 0 0 1 48 0 v38`} fill="none" stroke={INK} strokeWidth="10" />
            <path d={`M${x - 24} 254 v-38 a24 24 0 0 1 48 0 v38`} fill="none" stroke={c} strokeWidth="5" />
            {letter(x, 222, l, INK, 20)}
          </g>
        ))}
        <path d="M24 70 h52 M40 88 h36 M224 60 h56 M232 78 h36" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  'squid-game': {
    bg: PINK,
    art: (
      <>
        <circle cx="86" cy="110" r="52" fill={INK} />
        <path d="M214 56 L270 156 H158Z" fill="none" stroke="white" strokeWidth="10" strokeLinejoin="round" />
        <rect x="104" y="180" width="92" height="92" rx="4" fill="none" stroke={LIME} strokeWidth="10" transform="rotate(8 150 226)" />
        <path d="M0 316 h300" stroke="white" strokeWidth="5" strokeDasharray="16 12" />
        <circle cx="86" cy="110" r="18" fill={CORAL} />
        <path d="M232 214 l18 -30 18 30z" fill={INK} />
      </>
    ),
  },
  'pac-man': {
    bg: '#DCDBFB',
    art: (
      <>
        <path
          d="M28 48 H272 V140 M28 48 V300 H120 M180 300 H272 V200 M84 104 H170 M84 104 V200 H150 M220 104 V150 M220 240 H140"
          fill="none"
          stroke={COBALT}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="translate(108 252)">
          <path d="M0 0 L40 -26 A48 48 0 1 0 40 26 Z" fill={LIME} stroke={INK} strokeWidth="4" />
          <circle cx="4" cy="-24" r="5" fill={INK} />
        </g>
        {[180, 212, 244].map((x) => (
          <circle key={x} cx={x} cy="252" r="6" fill={INK} />
        ))}
        <g transform="translate(206 150)">
          <path d="M0 40 V0 a28 28 0 0 1 56 0 V40 l-9 -9 -9 9 -10 -9 -10 9 -9 -9z" fill={CORAL} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="18" cy="2" r="8" fill="white" />
          <circle cx="40" cy="2" r="8" fill="white" />
          <circle cx="21" cy="4" r="3.5" fill={INK} />
          <circle cx="43" cy="4" r="3.5" fill={INK} />
        </g>
        <g transform="translate(150 178)">
          <rect x="-20" y="-20" width="40" height="40" rx="10" fill="white" stroke={INK} strokeWidth="3" />
          {letter(0, 1, '?', COBALT, 26)}
        </g>
      </>
    ),
  },
}

const FALLBACK: CoverStyle = {
  bg: INK,
  art: <circle cx="150" cy="160" r="70" fill={LIME} />,
}

interface GameCoverProps {
  gameId: string
  className?: string
  showTitle?: boolean
}

export function GameCover({ gameId, className = '', showTitle = true }: GameCoverProps) {
  const cover = COVERS[gameId] ?? FALLBACK
  const meta = GAME_META[gameId]

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: cover.bg }}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {cover.art}
      </svg>
      {showTitle && meta && (
        <p className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-xl border-2 border-ink bg-white px-2.5 py-1 text-[15px] font-extrabold leading-tight text-ink shadow-brutal-sm">
          {meta.title}
        </p>
      )}
    </div>
  )
}
