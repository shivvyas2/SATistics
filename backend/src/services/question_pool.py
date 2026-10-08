"""
Shared pool of AI-written questions that passed the format and answer-key checks

Writing and checking a question costs several LLM calls, so each one is kept in the
question_pool table and served again to students who haven't attempted it yet. New
questions are written only for what the pool can't cover. Questions copied from the
web are not pooled. Everything here is best effort: without the table (before
add_review_and_pool.sql has run) the pool is simply empty.
"""

import random
from typing import Dict, List, Optional

from src.services.question_sources import _matches_topic, is_quick_question
from src.utils.database import Database

# Newest pool entries looked at per request
POOL_SCAN = 600
GUEST_USER_ID = "00000000-0000-0000-0000-000000000000"


def _seen_question_ids(db, user_id: str) -> set:
    if user_id == GUEST_USER_ID:
        return set()
    rows = db.table("question_attempts").select("question_id").eq("user_id", user_id).limit(5000).execute().data
    return {row["question_id"] for row in rows}


def load(user_id: str, exam: str, section: str, count: int, weak_topics: List[str], pace: Optional[str]) -> List[Dict]:
    """Up to `count` pooled questions the student hasn't attempted, about half on weak topics"""
    if count <= 0:
        return []
    try:
        db = Database.get_client()
        rows = (
            db.table("question_pool")
            .select("question")
            .eq("exam", exam)
            .eq("section", section)
            .order("created_at", desc=True)
            .limit(POOL_SCAN)
            .execute()
            .data
        )
        seen = _seen_question_ids(db, user_id) if rows else set()
    except Exception as e:
        print(f"   ⚠️  Question pool unavailable: {e}")
        return []

    fresh = [r["question"] for r in rows if r["question"]["id"] not in seen]
    if pace == "quick":
        fresh = [q for q in fresh if is_quick_question(q)]
    random.shuffle(fresh)
    weak = [q for q in fresh if any(_matches_topic(t, q.get("topic"), q.get("skill")) for t in weak_topics)]
    weak_ids = {q["id"] for q in weak[: count // 2]}
    ordered = weak[: count // 2] + [q for q in fresh if q["id"] not in weak_ids]
    picked = ordered[:count]
    if picked:
        print(f"   ♻️  {len(picked)} questions from the pool")
    return picked


def save(questions: List[Dict]) -> None:
    """Adds checked AI-written questions to the pool; ones already there are left alone"""
    rows = [
        {
            "id": q["id"],
            "exam": q["exam"],
            "section": q["section"],
            "skill": q.get("skill") or "",
            "topic": q["topic"],
            "difficulty": q["difficulty"],
            "question": q,
        }
        for q in questions
        if q.get("source") == "ai"
    ]
    if not rows:
        return
    try:
        Database.get_client().table("question_pool").upsert(rows, on_conflict="id", ignore_duplicates=True).execute()
        print(f"   💾 Saved {len(rows)} questions to the pool")
    except Exception as e:
        print(f"   ⚠️  Could not save to the question pool: {e}")
