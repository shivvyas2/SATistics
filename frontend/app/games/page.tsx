'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/DashboardLayout'
import { GameCover } from '@/components/brand/GameCover'
import { PlayIcon, SearchIcon } from '@/components/brand/Icons'
import { games } from '@/lib/games'
import { GAME_META, GENRES, Genre, gameTitle } from '@/lib/gameMeta'
import { GameRecord, recordsByGame, timeAgo, useRecentSessions } from '@/lib/sessions'

export default function GamesPage() {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<Genre | null>(null)
  const sessions = useRecentSessions(50)
  const records = useMemo(() => (sessions ? recordsByGame(sessions) : null), [sessions])
  const playsById = useMemo(() => new Map(records?.map((r) => [r.gameId, r.plays])), [records])

  const visible = games.filter((game) => {
    const meta = GAME_META[game.id]
    const text = `${meta?.title ?? game.name} ${meta?.answerBy ?? ''}`.toLowerCase()
    return (!genre || meta?.genre === genre) && text.includes(query.trim().toLowerCase())
  })

  return (
    <DashboardLayout aside={<YourGames records={records} />}>
      <div className="p-5 sm:p-8">
        <h1 className="text-5xl font-extrabold tracking-tight">Explore</h1>
        <p className="mt-2 max-w-lg text-ink/65">Every game pulls from the same question bank. Pick the one you&apos;ll actually want to replay.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search games</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-44 rounded-full border-2 border-ink bg-white py-1.5 pl-9 pr-4 text-sm font-semibold outline-none focus:shadow-[2px_2px_0_0_#3A33E8]"
            />
          </label>
          {[null, ...GENRES].map((g) => (
            <button
              key={g ?? 'all'}
              onClick={() => setGenre(g)}
              aria-pressed={genre === g}
              className={`chip ${genre === g ? 'bg-ink text-white' : 'bg-white hover:bg-cobalt-soft'}`}
            >
              {g ?? 'All'}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-10 rounded-[24px] border-2 border-dashed border-ink/30 p-10 text-center">
            <p className="text-lg font-bold">No games match “{query}”.</p>
            <button onClick={() => { setQuery(''); setGenre(null) }} className="btn btn-paper mt-4 text-sm">
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3">
            {visible.map((game) => {
              const meta = GAME_META[game.id]
              const plays = playsById.get(game.id) ?? 0
              return (
                <li key={game.id}>
                  <Link href={`/games/${game.id}/select`} className="group block">
                    <div className="relative">
                      <GameCover gameId={game.id} showTitle={false} className="brutal aspect-[3/4] rounded-[22px] transition-transform group-hover:-translate-y-1" />
                      <span className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white opacity-0 shadow-brutal-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <PlayIcon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-extrabold leading-tight">{meta?.title ?? game.name}</p>
                    <p className="text-sm text-ink/55">
                      {meta?.genre}
                      {plays > 0 ? `, played ${plays} ${plays === 1 ? 'time' : 'times'}` : ''}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-10 xl:hidden">
          <YourGames records={records} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function YourGames({ records }: { records: GameRecord[] | null }) {
  return (
    <section className="min-h-full rounded-[28px] border-2 border-ink bg-ink p-6 text-white">
      <h2 className="text-2xl font-extrabold">Your games</h2>
      {records === null ? (
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="mt-6">
          <p className="text-white/70">Games you play land here with your best score, so you can jump back in.</p>
          <Link href="/games/whackamole/select" className="btn btn-lime mt-5 w-full text-sm">
            Start with Whack-A-Mole
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {records.slice(0, 6).map((r) => (
            <li key={r.gameId} className="flex gap-4">
              <GameCover gameId={r.gameId} showTitle={false} className="aspect-[3/4] w-20 shrink-0 rounded-2xl border-2 border-white/20" />
              <div className="min-w-0 py-1">
                <p className="truncate font-extrabold">{gameTitle(r.gameId, r.gameId)}</p>
                <p className="text-sm text-white/55">
                  Best {r.bestScore.toLocaleString()}, {timeAgo(r.lastPlayed)}
                </p>
                <Link href={`/games/${r.gameId}/select`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20">
                  <PlayIcon className="h-3 w-3" /> Play again
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
