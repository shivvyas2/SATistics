"""
Questions from a user's own uploaded material, in the format the games use
"""

import random
from typing import Dict, List, Optional

from src.services.question_sources import is_quick_question
from src.utils.database import Database

# Keeps custom question ids clear of the ids other sources produce
CUSTOM_ID_OFFSET = 1_500_000_000


def to_game_question(row: Dict, material_name: str) -> Dict:
    passage = row.get("passage") or ""
    stem = row["question"]
    return {
        "id": CUSTOM_ID_OFFSET + row["id"],
        "question": f"{passage}\n\n{stem}" if passage else stem,
        "options": row["options"],
        "correctAnswer": row["correct_answer"],
        "topic": row.get("topic") or "My material",
        "difficulty": row.get("difficulty") or "medium",
        "explanation": row.get("explanation") or "",
        "passage": passage,
        "stem": stem,
        "exam": row["exam"],
        "section": row["section"],
        "source": "custom",
        "sourceName": material_name,
    }


def load_custom_questions(user_id: str, exam: str, section: str, pace: Optional[str], limit: int) -> List[Dict]:
    """Up to `limit` of the user's approved questions for an exam section, in random order"""
    if limit <= 0:
        return []
    try:
        db = Database.get_client()
        rows = (
            db.table("custom_questions")
            .select("*")
            .eq("user_id", user_id)
            .eq("exam", exam)
            .eq("section", section)
            .eq("status", "approved")
            .execute()
            .data
        )
        if not rows:
            return []
        materials = db.table("materials").select("id,name").eq("user_id", user_id).execute().data
        names = {m["id"]: m["name"] for m in materials}
    except Exception as e:
        print(f"Error loading custom questions: {e}")
        return []

    questions = [to_game_question(row, names.get(row["material_id"], "Your material")) for row in rows]
    if pace == "quick":
        questions = [q for q in questions if is_quick_question(q)]
    random.shuffle(questions)
    return questions[:limit]
