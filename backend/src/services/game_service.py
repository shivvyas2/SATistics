"""
Game score service - handles saving game sessions and analytics
"""

from supabase import Client
from src.models.schemas import GameAnalytics, SaveScoreRequest
from typing import Dict
from datetime import datetime

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
                attempts_data = [
                    {
                        "session_id": session_id,
                        "user_id": user_id,
                        "question_id": attempt.questionId,
                        "topic": attempt.topic,
                        "difficulty": attempt.difficulty,
                        "is_correct": attempt.isCorrect,
                        "time_spent": attempt.timeSpent,
                    }
                    for attempt in analytics.questionAttempts
                ]
                
                self.db.table("question_attempts").insert(attempts_data).execute()
            
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

