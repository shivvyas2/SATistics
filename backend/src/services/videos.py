"""
Finds lesson videos for a course topic.
Providers are tried in order: YouTube Data API (YOUTUBE_API_KEY), Serper
(SERPER_API_KEY), then DuckDuckGo, which needs no key but rate limits.
Results are YouTube-only (so they can be embedded) and ranked toward
lesson-length videos from established test-prep channels.
"""

import asyncio
import math
import os
import re
import time
from typing import Dict, List, Optional

import httpx
from ddgs import DDGS

from src.services.question_sources import EXAMS

# Official partners and long-running prep channels get ranked first
TRUSTED_CHANNELS = (
    "khan academy", "college board", "ets", "official gre",
    "gregmat", "magoosh", "scalar learning", "princeton review",
    "kaplan", "prepscholar", "supertutor", "1600.io", "target test prep",
)

CACHE_TTL_SECONDS = 24 * 60 * 60
_cache: Dict[str, tuple] = {}

YOUTUBE_ID = re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})")


def _duration_minutes(duration: str) -> Optional[float]:
    try:
        parts = [int(p) for p in duration.split(":")]
    except (AttributeError, ValueError):
        return None
    seconds = 0
    for part in parts:
        seconds = seconds * 60 + part
    return seconds / 60


def _score(video: Dict) -> float:
    score = 0.0
    if video["trusted"]:
        score += 3
    minutes = video["minutes"]
    if minutes is not None:
        if 3 <= minutes <= 25:
            score += 2  # Fits in a study session
        elif minutes <= 60:
            score += 0.5
        else:
            score -= 2  # Multi-hour livestreams
    score += math.log10(max(video["views"], 1)) / 3
    return score


ISO_DURATION = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


def _iso_to_clock(iso: str) -> str:
    """PT1H2M3S -> 1:02:03"""
    match = ISO_DURATION.fullmatch(iso or "")
    if not match:
        return ""
    h, m, sec = (int(x or 0) for x in match.groups())
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _video(url: str, title: str, channel: str, duration: str, views, published: str) -> Optional[Dict]:
    match = YOUTUBE_ID.search(url or "")
    if not match:
        return None
    video_id = match.group(1)
    channel = (channel or "").strip()
    lowered = channel.lower()
    return {
        "id": video_id,
        "title": (title or "").strip(),
        "channel": channel,
        "duration": duration or "",
        "minutes": _duration_minutes(duration or ""),
        "views": int(views or 0),
        "published": (published or "")[:10],
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "trusted": any(name in lowered.split(" ") or (" " in name and name in lowered) for name in TRUSTED_CHANNELS),
    }


async def _search_youtube(client: httpx.AsyncClient, query: str, key: str) -> List[Dict]:
    found = await client.get(
        "https://www.googleapis.com/youtube/v3/search",
        params={"part": "snippet", "type": "video", "videoEmbeddable": "true", "maxResults": 15, "q": query, "key": key},
    )
    found.raise_for_status()
    items = found.json().get("items", [])
    ids = [item["id"]["videoId"] for item in items if item.get("id", {}).get("videoId")]
    if not ids:
        return []
    # Search results carry no duration or views; fetch them in one call
    details = await client.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={"part": "contentDetails,statistics", "id": ",".join(ids), "key": key},
    )
    details.raise_for_status()
    extra = {d["id"]: d for d in details.json().get("items", [])}
    videos = []
    for item in items:
        video_id = item.get("id", {}).get("videoId")
        if not video_id:
            continue
        snippet, detail = item.get("snippet", {}), extra.get(video_id, {})
        videos.append(_video(
            f"https://www.youtube.com/watch?v={video_id}",
            snippet.get("title", ""),
            snippet.get("channelTitle", ""),
            _iso_to_clock(detail.get("contentDetails", {}).get("duration", "")),
            detail.get("statistics", {}).get("viewCount"),
            snippet.get("publishedAt", ""),
        ))
    return [v for v in videos if v]


async def _search_serper(client: httpx.AsyncClient, query: str, key: str) -> List[Dict]:
    response = await client.post(
        "https://google.serper.dev/videos",
        headers={"X-API-KEY": key, "Content-Type": "application/json"},
        json={"q": query, "num": 15},
    )
    response.raise_for_status()
    videos = [
        _video(r.get("link", ""), r.get("title", ""), r.get("channel", ""), r.get("duration", ""), 0, r.get("date", ""))
        for r in response.json().get("videos", [])
    ]
    return [v for v in videos if v]


def _search_ddg(query: str, max_retries: int = 2) -> List[Dict]:
    """DuckDuckGo reports rate limiting as "No results found", so retry with backoff"""
    for attempt in range(max_retries):
        if attempt > 0:
            time.sleep(2 ** attempt)
        try:
            raw = DDGS().videos(query, max_results=15)
        except Exception as e:
            print(f"   ⚠️  Video search error for '{query}': {e}")
            continue
        videos = [
            _video(r.get("content", ""), r.get("title", ""), r.get("uploader", ""), r.get("duration", ""),
                   (r.get("statistics") or {}).get("viewCount"), r.get("published", ""))
            for r in raw
        ]
        return [v for v in videos if v]
    return []


async def _search(client: httpx.AsyncClient, query: str) -> List[Dict]:
    """First provider that returns results wins"""
    youtube_key, serper_key = os.getenv("YOUTUBE_API_KEY"), os.getenv("SERPER_API_KEY")
    providers = []
    if youtube_key:
        providers.append(("YouTube", lambda: _search_youtube(client, query, youtube_key)))
    if serper_key:
        providers.append(("Serper", lambda: _search_serper(client, query, serper_key)))
    providers.append(("DuckDuckGo", lambda: asyncio.to_thread(_search_ddg, query)))

    for name, search in providers:
        try:
            videos = await search()
        except httpx.HTTPError as e:
            print(f"   ⚠️  {name} video search failed for '{query}': {e}")
            continue
        if videos:
            return videos
    return []


async def find_topic_videos(exam: str, section: str, topic: str, limit: int = 6) -> List[Dict]:
    key = f"{exam}:{section}:{topic.lower()}"
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1][:limit]

    exam_name = EXAMS[exam]["name"]
    section_name = EXAMS[exam]["sections"][section]["name"]
    queries = [
        f"{exam_name} {topic} lesson",
        f"Khan Academy {exam_name} {topic}" if exam == "sat" else f"GregMat GRE {topic}",
        f"{exam_name} {section_name} {topic} explained",
    ]
    # One query at a time: parallel queries get rate limited
    videos: Dict[str, Dict] = {}
    async with httpx.AsyncClient(timeout=10) as client:
        for query in queries:
            for video in await _search(client, query):
                videos.setdefault(video["id"], video)
            if len(videos) >= 15:
                break

    ranked = sorted(videos.values(), key=_score, reverse=True)
    # Only cache real results, so a rate-limited search is retried next time
    if ranked:
        _cache[key] = (time.time(), ranked)
    return ranked[:limit]
