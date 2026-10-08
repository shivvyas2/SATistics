"""
Game score service - handles saving game sessions and analytics
"""

from supabase import Client
from src.models.schemas import GameAnalytics, QuestionAttempt, SaveScoreRequest
from src.utils.html_utils import sanitize_html
from typing import Any, Dict, List, Optional
from datetime import datetime

# Fields of a question kept with each attempt for the review; anything else the client sends is dropped
REVIEW_TEXT_FIELDS = ("question", "stem", "passage", "explanation", "topic", "skill", "difficulty", "source", "sourceName")
REVIEW_HTML_FIELDS = ("questionHtml", "passageHtml", "explanationHtml")
MAX_REVIEW_TEXT = 20_000
OFFICIAL_BANK_URL = "https://satsuitequestionbank.collegeboard.org"


def review_snapshot(question: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The parts of a question the review shows. It comes from the browser, so HTML is sanitized again"""
    if not isinstance(question, dict) or not isinstance(question.get("options"), list):
        return None
    options = [str(o)[:MAX_REVIEW_TEXT] for o in question["options"][:5]]
    correct = question.get("correctAnswer")
    if question.get("source") == "official":
        # College Board's questions aren't copied into our database: the saved review keeps
        # the answers and points to the official question bank instead
        return {
            "source": "official",
            "sourceName": "College Board Educator Question Bank",
            "sourceUrl": OFFICIAL_BANK_URL,
            "topic": str(question.get("topic") or "")[:200],
            "skill": str(question.get("skill") or "")[:200],
            "difficulty": str(question.get("difficulty") or "")[:20],
            "optionCount": len(options),
            "correctAnswer": correct if isinstance(correct, int) and 0 <= correct < len(options) else None,
        }
    snapshot: Dict[str, Any] = {
        "options": options,
        "correctAnswer": correct if isinstance(correct, int) and 0 <= correct < len(options) else None,
    }
    for field in REVIEW_TEXT_FIELDS:
        if isinstance(question.get(field), str):
            snapshot[field] = question[field][:MAX_REVIEW_TEXT]
    for field in REVIEW_HTML_FIELDS:
        if isinstance(question.get(field), str) and question[field]:
            snapshot[field] = sanitize_html(question[field][:MAX_REVIEW_TEXT])
    for field in ("optionsHtml", "optionExplanations"):
        values = question.get(field)
        if isinstance(values, list) and len(values) == len(options):
            clean = [str(v or "")[:MAX_REVIEW_TEXT] for v in values]
            snapshot[field] = [sanitize_html(v) for v in clean] if field == "optionsHtml" else clean
    return snapshot


class GameService:
    def __init__(self, db: Client):
        self.db = db
    
    async def save_game_session(
        self, 
        user_id: str, 
        game_id: str, 
        analytics: GameAnalytics
    ) -> Dict:
        """Save a game session and update user statistics"""
        try:
            # Insert game session
            session_data = {
                "user_id": user_id,
                "game_id": game_id,
                "score": analytics.score,
                "accuracy": self._accuracy(analytics),
                "correct_answers": analytics.correctAnswers,
                "wrong_answers": analytics.wrongAnswers,
                "max_streak": analytics.streakInfo.get("maxStreak", 0),
                "average_response_time": analytics.averageResponseTime,
            }
            
            session_result = self.db.table("game_sessions").insert(session_data).execute()
            
            if not session_result.data:
                return {"success": False, "error": "Failed to create game session"}
            
            session = session_result.data[0]
            session_id = session["id"]
            
            # Insert question attempts
            if analytics.questionAttempts:
                self._save_attempts(session_id, user_id, analytics.questionAttempts)
            
            # Update user stats
            await self._update_user_stats(user_id, analytics)
            
            return {
                "success": True,
                "sessionId": session_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _save_attempts(self, session_id: str, user_id: str, attempts: List[QuestionAttempt]) -> None:
        rows = [
            {
                "session_id": session_id,
                "user_id": user_id,
                "question_id": attempt.questionId,
                "topic": attempt.topic,
                "difficulty": attempt.difficulty,
                "is_correct": attempt.isCorrect,
                "time_spent": attempt.timeSpent,
                "question": review_snapshot(attempt.question),
                "selected_answer": attempt.selected,
                "position": position,
            }
            for position, attempt in enumerate(attempts)
        ]
        try:
            self.db.table("question_attempts").insert(rows).execute()
        except Exception as e:
            # Before add_review_and_pool.sql has run, save the attempts without their review
            print(f"Saving attempts without review data: {e}")
            review_columns = ("question", "selected_answer", "position")
            self.db.table("question_attempts").insert(
                [{k: v for k, v in row.items() if k not in review_columns} for row in rows]
            ).execute()

    @staticmethod
    def _accuracy(analytics: GameAnalytics) -> float:
        """Share of questions answered correctly, from 0 to 1"""
        total = analytics.correctAnswers + analytics.wrongAnswers
        return analytics.correctAnswers / total if total > 0 else 0

    async def _update_user_stats(self, user_id: str, analytics: GameAnalytics):
        """Update or create user statistics"""
        # Get existing stats
        stats_result = self.db.table("user_stats").select("*").eq("user_id", user_id).execute()
        
        # Calculate weak/strong topics
        weak_topics = []
        strong_topics = []
        
        for topic, perf in analytics.topicPerformance.items():
            if perf.total > 0:
                # Games report topic accuracy as a percentage, so work from the counts
                topic_accuracy = perf.correct / perf.total
                if topic_accuracy < 0.5:
                    weak_topics.append(topic)
                elif topic_accuracy >= 0.8:
                    strong_topics.append(topic)
        
        total_questions = analytics.correctAnswers + analytics.wrongAnswers
        
        if stats_result.data:
            # Update existing stats
            existing = stats_result.data[0]
            
            new_total_games = existing["total_games_played"] + 1
            new_total_score = existing["total_score"] + analytics.score
            new_total_questions = existing["total_questions_answered"] + total_questions
            new_total_correct = existing["total_correct"] + analytics.correctAnswers
            new_total_wrong = existing["total_wrong"] + analytics.wrongAnswers
            new_accuracy = new_total_correct / new_total_questions if new_total_questions > 0 else 0
            
            # Merge topics
            # A topic moves between the lists as the player improves or slips
            merged_weak = list((set(existing.get("weak_topics") or []) - set(strong_topics)) | set(weak_topics))
            merged_strong = list((set(existing.get("strong_topics") or []) - set(weak_topics)) | set(strong_topics))
            
            self.db.table("user_stats").update({
                "total_games_played": new_total_games,
                "total_score": new_total_score,
                "total_questions_answered": new_total_questions,
                "total_correct": new_total_correct,
                "total_wrong": new_total_wrong,
                "overall_accuracy": new_accuracy,
                "weak_topics": merged_weak,
                "strong_topics": merged_strong,
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("user_id", user_id).execute()
        else:
            # Create new stats
            self.db.table("user_stats").insert({
                "user_id": user_id,
                "total_games_played": 1,
                "total_score": analytics.score,
                "total_questions_answered": total_questions,
                "total_correct": analytics.correctAnswers,
                "total_wrong": analytics.wrongAnswers,
                "overall_accuracy": self._accuracy(analytics),
                "weak_topics": weak_topics,
                "strong_topics": strong_topics,
            }).execute()

