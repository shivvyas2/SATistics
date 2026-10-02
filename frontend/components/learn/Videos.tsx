'use client'

import { useEffect, useState } from 'react'
import { apiClient, Video } from '@/lib/api/client'
import { PlayIcon } from '@/components/brand/Icons'
import type { ExamId, SectionId } from '@/lib/exam'
import { EXAMS } from '@/lib/exam'

// Video searches are slow, so results are kept for the whole visit
const cache = new Map<string, Promise<Video[]>>()

export function useTopicVideos(exam: ExamId, section: SectionId, topic: string | null, limit = 6) {
  const [state, setState] = useState<{ videos: Video[] | null; failed: boolean }>({ videos: null, failed: false })

  useEffect(() => {
    if (!topic) return
    const key = `${exam}:${section}:${topic}:${limit}`
    let request = cache.get(key)
    if (!request) {
      request = apiClient.getTopicVideos(exam, section, topic, limit)
      cache.set(key, request)
      // Let a failed search be retried on the next visit
      request.catch(() => cache.delete(key))
    }
    let active = true
    setState({ videos: null, failed: false })
    request
      .then((videos) => active && setState({ videos, failed: false }))
      .catch(() => active && setState({ videos: [], failed: true }))
    return () => {
      active = false
    }
  }, [exam, section, topic, limit])

  return state
}

export function youtubeSearchUrl(exam: ExamId, topic: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${EXAMS[exam].name} ${topic} lesson`)}`
}

/** Thumbnail that swaps itself for the YouTube player when clicked */
export function VideoPlayer({ video, autoPlay = false }: { video: Video; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(autoPlay)
  useEffect(() => setPlaying(autoPlay), [video.id, autoPlay])

  return (
    <div className="relative aspect-video overflow-hidden rounded-[22px] border-2 border-ink bg-ink">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play ${video.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnail} alt="" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-lime shadow-brutal transition-transform group-hover:scale-105">
            <PlayIcon className="ml-1 h-6 w-6 text-ink" />
          </span>
        </button>
      )}
    </div>
  )
}

export function VideoMeta({ video }: { video: Video }) {
  return (
    <span className="text-sm text-ink/55">
      {video.channel}
      {video.trusted && <span className="ml-1.5 rounded-full bg-cobalt-soft px-2 py-0.5 text-[11px] font-bold text-cobalt">Prep channel</span>}
      {video.duration && <span className="ml-1.5">{video.duration}</span>}
    </span>
  )
}

/** Compact row used in lists of videos */
export function VideoRow({ video, active, onSelect }: { video: Video; active?: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full gap-3 rounded-2xl border-2 p-2 text-left transition-colors ${active ? 'border-ink bg-lime-soft' : 'border-transparent hover:bg-white'}`}
    >
      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        {video.duration && <span className="absolute bottom-1 right-1 rounded bg-ink/85 px-1 text-[11px] font-bold text-white">{video.duration}</span>}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-bold leading-snug">{video.title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink/55">{video.channel}</span>
      </span>
    </button>
  )
}

export function VideosUnavailable({ exam, topic, failed }: { exam: ExamId; topic: string; failed: boolean }) {
  return (
    <div className="rounded-[22px] border-2 border-dashed border-ink/30 p-5 text-sm">
      <p className="font-bold">{failed ? 'Video search is unavailable right now.' : 'No lesson videos found for this topic yet.'}</p>
      <a href={youtubeSearchUrl(exam, topic)} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-cobalt underline decoration-2 underline-offset-4">
        Search YouTube for {topic}
      </a>
    </div>
  )
}
