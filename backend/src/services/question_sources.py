"""
Question sources for the learning agent

- CollegeBoardSource: real digital SAT questions from College Board's
  Educator Question Bank (the same data that backs satsuitequestionbank.collegeboard.org)
- WebQuestionSource: searches the web for practice questions, reads the pages,
  and lets the LLM extract the questions that actually appear on them
"""

import asyncio
import math
import random
import re
import time
from typing import Dict, List, Optional

from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from ddgs import DDGS

from src.utils.html_utils import has_figure, html_to_text, sanitize_html

EXAMS = {
    "sat": {
        "name": "SAT",
        "sections": {
            "quant": {"name": "Math", "option_count": 4},
            "verbal": {"name": "Reading and Writing", "option_count": 4},
        },
    },
    "gre": {
        "name": "GRE",
        "sections": {
            "quant": {"name": "Quantitative Reasoning", "option_count": 5},
            "verbal": {"name": "Verbal Reasoning", "option_count": 5},
        },
    },
}

DIFFICULTIES = ["easy", "medium", "hard"]

# Fast games need questions that can be read and answered in seconds; slow games
# take the long passages and multi-step problems
QUICK_SKILLS = {"Words in Context", "Boundaries", "Form, Structure, and Sense", "Transitions"}
QUICK_MAX_CHARS = {"quant": 220, "verbal": 420}
QUICK_MAX_OPTION_CHARS = 60

# Practice pages are fetched under an honest name, so site owners can see who reads them
# and opt out in robots.txt; the URL explains the bot
BOT_NAME = "SATisticsBot"
BOT_HEADERS = {"User-Agent": f"{BOT_NAME}/1.0 (+https://www.satistic.tech/credits#bot)"}


def section_label(exam: str, section: str) -> str:
    return f"{EXAMS[exam]['name']} {EXAMS[exam]['sections'][section]['name']}"


def _matches_topic(topic: str, *names: str) -> bool:
    topic = topic.lower()
    return any(topic in name.lower() or name.lower() in topic for name in names if name)


class CollegeBoardSource:
    """Real SAT questions from the College Board Educator Question Bank"""

    BASE_URL = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital"
    SOURCE_URL = "https://satsuitequestionbank.collegeboard.org"
    SECTIONS = {
        "quant": {"test": 2, "domain": "H,P,Q,S"},
        "verbal": {"test": 1, "domain": "INI,CAS,EOI,SEC"},
    }
    DIFFICULTY_CODES = {"E": "easy", "M": "medium", "H": "hard"}
    INDEX_TTL_SECONDS = 6 * 60 * 60
    MAX_CONCURRENT_REQUESTS = 16
    # Share of candidates that survive the filters, measured on the live bank
    USABLE_SHARE = {
        ("quant", None): 0.55, ("quant", "deep"): 0.55, ("quant", "quick"): 0.45,
        ("verbal", None): 0.95, ("verbal", "deep"): 0.95, ("verbal", "quick"): 0.55,
    }
    MAX_ROUNDS = 3
    # Question details already fetched, by external_id; they don't change
    DETAIL_CACHE_SIZE = 4000
    _detail_cache: Dict[str, Dict] = {}

    _index_cache: Dict[str, tuple] = {}

    @classmethod
    async def _get_index(cls, client: httpx.AsyncClient, section: str) -> List[Dict]:
        cached = cls._index_cache.get(section)
        if cached and time.time() - cached[0] < cls.INDEX_TTL_SECONDS:
            return cached[1]

        response = await client.post(
            f"{cls.BASE_URL}/get-questions",
            json={"asmtEventId": 99, **cls.SECTIONS[section]},
        )
        response.raise_for_status()
        # Only entries with an external_id can be fetched from this API
        index = [q for q in response.json() if q.get("external_id")]
        cls._index_cache[section] = (time.time(), index)
        return index

    @classmethod
    def _fits_pace(cls, entry: Dict, section: str, pace: Optional[str]) -> bool:
        """Pre-filter on index metadata, before the question text is known"""
        is_quick_skill = entry.get("skill_desc") in QUICK_SKILLS
        if pace == "quick":
            return entry.get("difficulty") != "H" and (section == "quant" or is_quick_skill)
        if pace == "deep":
            return entry.get("difficulty") != "E" if section == "quant" else not is_quick_skill
        return True

    @classmethod
    def _pick_candidates(cls, index: List[Dict], count: int, weak_topics: List[str]) -> List[Dict]:
        """Even spread over difficulties, with about half of each band on weak topics"""
        picked = []
        per_band = -(-count // len(cls.DIFFICULTY_CODES))
        for code in cls.DIFFICULTY_CODES:
            band = [q for q in index if q.get("difficulty") == code]
            random.shuffle(band)
            weak = [
                q for q in band
                if any(_matches_topic(t, q.get("primary_class_cd_desc"), q.get("skill_desc")) for t in weak_topics)
            ]
            chosen = weak[: per_band // 2]
            chosen_ids = {q["external_id"] for q in chosen}
            chosen += [q for q in band if q["external_id"] not in chosen_ids][: per_band - len(chosen)]
            picked += chosen
        random.shuffle(picked)
        return picked

    @classmethod
    def _normalize(cls, entry: Dict, detail: Dict, section: str) -> Optional[Dict]:
        """Convert a question bank item to the game format; None if a game can't show it"""
        if detail.get("type") != "mcq":
            return None
        options = detail.get("answerOptions") or []
        stem = detail.get("stem") or ""
        stimulus = detail.get("stimulus") or ""
        contents = [stem, stimulus] + [o.get("content", "") for o in options]
        if len(options) < 2 or any(has_figure(c) for c in contents):
            return None

        keys = detail.get("keys") or []
        correct = next((i for i, o in enumerate(options) if o.get("id") in keys), -1)
        if correct == -1:
            letters = detail.get("correct_answer") or []
            correct = "ABCDE".find(letters[0]) if letters else -1
        if not 0 <= correct < len(options):
            return None

        stem_text = html_to_text(stem)
        passage_text = html_to_text(stimulus)
        rationale = detail.get("rationale") or ""
        return {
            "id": int(entry["questionId"], 16) & 0x7FFFFFFF,
            "question": f"{passage_text}\n\n{stem_text}" if passage_text else stem_text,
            "options": [html_to_text(o.get("content", "")) for o in options],
            "correctAnswer": correct,
            "topic": entry.get("primary_class_cd_desc") or "General",
            "skill": entry.get("skill_desc") or "",
            "difficulty": cls.DIFFICULTY_CODES.get(entry.get("difficulty"), "medium"),
            "explanation": html_to_text(rationale),
            "passage": passage_text,
            "stem": stem_text,
            "questionHtml": sanitize_html(stem),
            "passageHtml": sanitize_html(stimulus),
            "optionsHtml": [sanitize_html(o.get("content", "")) for o in options],
            "explanationHtml": sanitize_html(rationale),
            "exam": "sat",
            "section": section,
            "source": "official",
            "sourceName": "College Board Educator Question Bank",
            "sourceUrl": cls.SOURCE_URL,
        }

    @classmethod
    async def warm(cls, section: str) -> None:
        """Loads the question index ahead of time, while other work runs"""
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                await cls._get_index(client, section)
        except Exception:
            pass

    @classmethod
    async def _detail(cls, client: httpx.AsyncClient, external_id: str) -> Dict:
        cached = cls._detail_cache.get(external_id)
        if cached is not None:
            return cached
        response = await client.post(f"{cls.BASE_URL}/get-question", json={"external_id": external_id})
        response.raise_for_status()
        detail = response.json()
        if len(cls._detail_cache) > cls.DETAIL_CACHE_SIZE:
            cls._detail_cache.clear()
        cls._detail_cache[external_id] = detail
        return detail

    @classmethod
    async def fetch(
        cls, section: str, limit: int, weak_topics: Optional[List[str]] = None, pace: Optional[str] = None
    ) -> List[Dict]:
        """
        Up to `limit` usable questions. Figure-based, free-response and (for quick games) long
        items get dropped, so candidates are fetched in rounds sized by how many usually survive,
        rather than over-fetching everything up front
        """
        semaphore = asyncio.Semaphore(cls.MAX_CONCURRENT_REQUESTS)
        usable_share = cls.USABLE_SHARE.get((section, pace), 0.5)
        questions: List[Dict] = []

        async with httpx.AsyncClient(timeout=20) as client:
            index = [q for q in await cls._get_index(client, section) if cls._fits_pace(q, section, pace)]

            async def fetch_one(entry: Dict) -> Optional[Dict]:
                async with semaphore:
                    try:
                        return cls._normalize(entry, await cls._detail(client, entry["external_id"]), section)
                    except Exception as e:
                        print(f"   ⚠️  Could not load question {entry.get('questionId')}: {e}")
                        return None

            for _ in range(cls.MAX_ROUNDS):
                missing = limit - len(questions)
                if missing <= 0 or not index:
                    break
                candidates = cls._pick_candidates(index, math.ceil(missing / usable_share * 1.25) + 2, weak_topics or [])
                tried = {c["external_id"] for c in candidates}
                index = [q for q in index if q["external_id"] not in tried]
                results = await asyncio.gather(*(fetch_one(entry) for entry in candidates))
                questions += [q for q in results if q and (pace != "quick" or is_quick_question(q))]

        return _balance_difficulty(questions, limit)

    @classmethod
    async def examples(cls, section: str, skill: str, difficulty: str, count: int = 3) -> List[Dict]:
        """A few real questions of one skill and difficulty, to show the question writer; empty if unreachable"""
        code = next(c for c, d in cls.DIFFICULTY_CODES.items() if d == difficulty)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                index = await cls._get_index(client, section)
                same_skill = [q for q in index if (q.get("skill_desc") or "").strip().lower() == skill.lower()]
                pool = [q for q in same_skill if q.get("difficulty") == code] or same_skill
                candidates = random.sample(pool, min(len(pool), count * 3))

                async def fetch_one(entry: Dict) -> Optional[Dict]:
                    return cls._normalize(entry, await cls._detail(client, entry["external_id"]), section)

                results = await asyncio.gather(*(fetch_one(e) for e in candidates), return_exceptions=True)
        except Exception as e:
            print(f"   ⚠️  No College Board examples for {skill}: {e}")
            return []
        return [q for q in results if isinstance(q, dict)][:count]


def is_quick_question(question: Dict) -> bool:
    """Short enough to read and answer while a fast game keeps moving"""
    return (
        len(question["question"]) <= QUICK_MAX_CHARS[question["section"]]
        and all(len(option) <= QUICK_MAX_OPTION_CHARS for option in question["options"])
    )


def _balance_difficulty(questions: List[Dict], limit: int) -> List[Dict]:
    """Take questions round-robin across difficulties so the pool stays mixed"""
    bands = {d: [q for q in questions if q["difficulty"] == d] for d in DIFFICULTIES}
    balanced = []
    while len(balanced) < limit and any(bands.values()):
        for difficulty in DIFFICULTIES:
            if bands[difficulty] and len(balanced) < limit:
                balanced.append(bands[difficulty].pop())
    return balanced


class WebQuestionSource:
    """Finds practice-question pages on the web and returns their readable text"""

    MAX_PAGE_CHARS = 9000
    MAX_PAGES = 4
    # robots.txt rules per site, kept for the life of the process
    _robots: Dict[str, RobotFileParser] = {}

    @staticmethod
    def search(query: str, max_results: int = 6, max_retries: int = 3) -> List[Dict]:
        """DuckDuckGo search with retry on rate limits"""
        print(f"   🦆 DuckDuckGo searching: '{query}'")
        for attempt in range(max_retries):
            if attempt > 0:
                wait_time = 2 ** attempt
                print(f"   ⏳ Waiting {wait_time}s before retry {attempt + 1}...")
                time.sleep(wait_time)
            try:
                return list(DDGS().text(query, max_results=max_results))
            except Exception as e:
                print(f"   ⚠️  Search error: {e}")
        return []

    @classmethod
    async def _allowed(cls, client: httpx.AsyncClient, url: str) -> bool:
        """Whether the site's robots.txt lets this bot read the page; unreachable rules count as no"""
        parts = urlsplit(url)
        root = f"{parts.scheme}://{parts.netloc}"
        rules = cls._robots.get(root)
        if rules is None:
            rules = RobotFileParser()
            try:
                response = await client.get(f"{root}/robots.txt")
                if response.status_code in (401, 403) or response.status_code >= 500:
                    rules.disallow_all = True
                elif response.status_code >= 400:
                    rules.allow_all = True
                else:
                    rules.parse(response.text.splitlines())
            except httpx.HTTPError:
                rules.disallow_all = True
            if len(cls._robots) > 500:
                cls._robots.clear()
            cls._robots[root] = rules
        return rules.can_fetch(BOT_NAME, url)

    @classmethod
    async def _read_page(cls, client: httpx.AsyncClient, url: str) -> Optional[Dict]:
        if not await cls._allowed(client, url):
            print(f"   🚫 robots.txt asks bots not to read {url}")
            return None
        try:
            response = await client.get(url)
            if response.status_code != 200 or "html" not in response.headers.get("content-type", ""):
                return None
            text = html_to_text(response.text)
        except (httpx.HTTPError, RecursionError, ValueError) as e:
            print(f"   ⚠️  Could not read {url}: {type(e).__name__}")
            return None
        # Pages without lettered answer choices are articles, not question sets
        first_choice = re.search(r"^\(?[A-E][.)]\s", text, re.MULTILINE)
        if not first_choice:
            return None
        start = max(0, first_choice.start() - 1500)
        return {"url": url, "text": text[start : start + cls.MAX_PAGE_CHARS]}

    @classmethod
    async def find_pages(cls, exam: str, section: str, topics: List[str]) -> List[Dict]:
        label = section_label(exam, section)
        queries = [f"{label} practice questions with answers and explanations"]
        if topics:
            queries.append(f"{label} {topics[0]} practice questions with answers")

        urls: List[str] = []
        for query in queries:
            for result in await asyncio.to_thread(cls.search, query):
                url = result.get("href")
                if url and url not in urls and not url.lower().endswith(".pdf"):
                    urls.append(url)

        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers=BOT_HEADERS) as client:
            pages = await asyncio.gather(*(cls._read_page(client, url) for url in urls[:8]))

        found = [p for p in pages if p][: cls.MAX_PAGES]
        print(f"   ✅ Found {len(found)} pages with practice questions")
        return found


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())
