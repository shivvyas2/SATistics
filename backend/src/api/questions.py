"""
Question bank endpoints
Supports both static questions and AI-generated personalized questions
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.models.schemas import QuestionResponse, Question
from src.utils.database import get_db
from src.api.auth import get_current_user
from src.services.agent import ExamLearningAgent
from supabase import Client
from typing import Literal, Optional

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
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get questions from the question bank
    
    If use_agent=true, the AI agent will analyze user performance and build a
    personalized set of real questions for the chosen exam section, weighted
    toward weak topics.
    
    Works with or without authentication:
    - With auth: Personalized based on user's performance
    - Without auth: Generic questions for new users
    """
    try:
        questions = []
        
        # Use AI agent to generate personalized questions
        if use_agent:
            try:
                # Use user ID if authenticated, otherwise use a guest ID
                user_id = str(current_user["id"]) if current_user else "00000000-0000-0000-0000-000000000000"
                agent = ExamLearningAgent(user_id)
                generated_questions = await agent.generate_questions(
                    num_questions=limit,
                    use_web_search=use_web_search,
                    exam=exam,
                    section=section,
                    pace=pace
                )
                questions = [Question(**q) for q in generated_questions]
            except Exception as agent_error:
                # If agent fails, fall back to static questions
                print(f"Agent error (falling back to static): {agent_error}")
                use_agent = False
        
        # Fall back to static questions if agent not used or failed
        if not use_agent or not questions:
            # TODO: Load questions from database or game files
            # For now, return empty list
            # You can import from frontend/games/carnival/questions.ts or whackamole/questions.ts
            pass
        
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

