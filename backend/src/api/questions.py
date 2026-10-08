"""
Question bank endpoints
Supports both static questions and AI-generated personalized questions
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.models.schemas import QuestionResponse, Question, RefillRequest
from src.utils.database import get_db
from src.api.auth import get_current_user
from src.services.agent import ExamLearningAgent
from src.services.custom_questions import load_custom_questions
from supabase import Client
from typing import Literal, Optional
import asyncio
import random
import time

router = APIRouter()
security = HTTPBearer(auto_error=False)

# Optional auth dependency - returns None if no token provided
async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """Get current authenticated user (optional - returns None if not authenticated)"""
    if not credentials:
        return None
    
    try:
        from src.services.auth_service import AuthService
        token = credentials.credentials
        auth_service = AuthService(get_db())
        user = await auth_service.get_user(token)
        return user
    except:
        return None

@router.get("/", response_model=QuestionResponse)
async def get_questions(
    topic: Optional[str] = Query(None, description="Filter by topic"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty (easy, medium, hard)"),
    limit: int = Query(10, ge=1, le=100, description="Number of questions to return"),
    use_agent: bool = Query(False, description="Use AI agent to generate personalized questions"),
    use_web_search: bool = Query(True, description="Use web search for real exam questions (slower)"),
    exam: Literal["sat", "gre"] = Query("sat", description="Exam to practice"),
    section: Literal["quant", "verbal"] = Query("quant", description="Exam section"),
    pace: Optional[Literal["quick", "deep"]] = Query(None, description="quick for fast games, deep for slow ones"),
    include_custom: bool = Query(True, description="Mix in approved questions from the user's own material"),
    wait_for_ai: bool = Query(False, description="Write missing questions now (slow) instead of returning a short set"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get questions from the question bank
    
    If use_agent=true, the AI agent will analyze user performance and build a
    personalized set of real questions for the chosen exam section, weighted
    toward weak topics.
    
    Works with or without authentication:
    - With auth: Personalized based on user's performance, with up to half the
      set drawn from questions they approved from their own material
    - Without auth: Generic questions for new users
    """
    try:
        questions = []
        custom = []
        
        # Use AI agent to generate personalized questions
        if use_agent:
            if current_user and include_custom:
                custom = await asyncio.to_thread(
                    load_custom_questions, str(current_user["id"]), exam, section, pace, limit // 2
                )
            try:
                # Use user ID if authenticated, otherwise use a guest ID
                user_id = str(current_user["id"]) if current_user else "00000000-0000-0000-0000-000000000000"
                agent = ExamLearningAgent(user_id)
                generated_questions = await agent.generate_questions(
                    num_questions=limit - len(custom),
                    use_web_search=use_web_search,
                    exam=exam,
                    section=section,
                    pace=pace,
                    wait_for_ai=wait_for_ai,
                )
                questions = [Question(**q) for q in custom + generated_questions]
                random.shuffle(questions)
            except Exception as agent_error:
                # If agent fails, fall back to static questions
                print(f"Agent error (falling back to static): {agent_error}")
                questions = [Question(**q) for q in custom]
        
        return QuestionResponse(
            questions=questions,
            total=len(questions)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/topics")
async def get_topics(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get available topics"""
    try:
        # Get unique topics from question_attempts or a topics table
        result = (
            db.table("question_attempts")
            .select("topic")
            .execute()
        )
        
        topics = list(set([attempt["topic"] for attempt in result.data]))
        
        return {"topics": topics}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# When each user last asked for a refill; writing questions costs AI credits
_last_refill: dict = {}
REFILL_COOLDOWN_SECONDS = 120


@router.post("/refill")
async def refill_question_pool(request: RefillRequest, current_user: dict = Depends(get_current_user)):
    """
    Writes and checks new AI questions into the shared pool, for sets that came back short.
    Takes about a minute; the client doesn't wait for it before starting a game
    """
    user_id = str(current_user["id"])
    now = time.time()
    if now - _last_refill.get(user_id, 0) < REFILL_COOLDOWN_SECONDS:
        return {"added": 0, "skipped": "A refill ran moments ago"}
    _last_refill[user_id] = now
    agent = ExamLearningAgent(user_id)
    added = await agent.refill_pool(request.exam, request.section, request.pace, request.count)
    return {"added": added}
