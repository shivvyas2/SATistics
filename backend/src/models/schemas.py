"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Any, List, Literal, Optional, Dict
from datetime import date, datetime

# Authentication Schemas
# Date of the Terms and Privacy Policy a new account agrees to; change it when either changes
TERMS_VERSION = "2026-10-08"

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    # The person confirmed they are 13 or older and agreed to the Terms and Privacy Policy
    accepted_terms: bool = False

    @model_validator(mode="after")
    def require_terms(self):
        if not self.accepted_terms:
            raise ValueError("Confirm you are 13 or older and agree to the Terms and Privacy Policy to create an account.")
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    # Exchanged at /api/auth/refresh for a new access token before this one expires
    refresh_token: Optional[str] = None
    # When the access token expires, in Unix seconds
    expires_at: Optional[int] = None

class RefreshRequest(BaseModel):
    refresh_token: str

class SessionTokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: Optional[int] = None

# Game Schemas
class QuestionAttempt(BaseModel):
    questionId: int
    topic: str
    difficulty: str
    isCorrect: bool
    timeSpent: int
    # The question as shown and the option picked (None when time ran out), for reviewing the game later
    question: Optional[Dict[str, Any]] = None
    selected: Optional[int] = None

class TopicPerformance(BaseModel):
    correct: int
    total: int
    accuracy: float

class GameAnalytics(BaseModel):
    gameId: str
    score: int
    accuracy: float
    correctAnswers: int
    wrongAnswers: int
    questionAttempts: List[QuestionAttempt]
    topicPerformance: Dict[str, TopicPerformance]
    streakInfo: dict
    averageResponseTime: int

class SaveScoreRequest(BaseModel):
    gameId: str
    analytics: GameAnalytics

class SaveScoreResponse(BaseModel):
    success: bool
    sessionId: str

# Statistics Schemas
class UserStatsResponse(BaseModel):
    total_games_played: int
    total_score: int
    total_questions_answered: int
    total_correct: int
    total_wrong: int
    overall_accuracy: float
    favorite_game: Optional[str]
    weak_topics: List[str]
    strong_topics: List[str]
    updated_at: str

class GameSessionResponse(BaseModel):
    id: str
    game_id: str
    score: int
    accuracy: float
    correct_answers: int
    wrong_answers: int
    max_streak: int
    created_at: str

# Question Bank Schemas
class Question(BaseModel):
    id: int
    question: str
    options: List[str]
    correctAnswer: int
    topic: str
    difficulty: str
    explanation: str
    # Exam metadata and rich (sanitized HTML/MathML) content for real exam questions
    exam: Optional[str] = None
    section: Optional[str] = None
    skill: Optional[str] = None
    passage: Optional[str] = None
    stem: Optional[str] = None  # question without its passage
    questionHtml: Optional[str] = None
    passageHtml: Optional[str] = None
    optionsHtml: Optional[List[str]] = None
    explanationHtml: Optional[str] = None
    # Why each option is wrong, in option order ("" for the correct one), when the source has it
    optionExplanations: Optional[List[str]] = None
    source: Optional[str] = None  # official, web, or ai
    sourceName: Optional[str] = None
    sourceUrl: Optional[str] = None

class QuestionResponse(BaseModel):
    questions: List[Question]
    total: int


# Profile Schemas
class Profile(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)
    username: str = Field(pattern=r"^[a-z0-9_]{3,24}$")
    exam: Literal["sat", "gre"] = "sat"
    target_score: Optional[int] = None
    test_date: Optional[date] = None
    daily_minutes: int = Field(default=20, ge=5, le=240)
    avatar_color: str = Field(default="#3A33E8", pattern=r"^#[0-9A-Fa-f]{6}$")

    @model_validator(mode="after")
    def check_target_score(self):
        low, high = (400, 1600) if self.exam == "sat" else (260, 340)
        if self.target_score is not None and not low <= self.target_score <= high:
            raise ValueError(f"Target score for the {self.exam.upper()} must be between {low} and {high}")
        return self

class ProfileResponse(BaseModel):
    profile: Optional[Profile]

# Learning Schemas
class Video(BaseModel):
    id: str
    title: str
    channel: str
    duration: str
    url: str
    thumbnail: str
    published: str
    trusted: bool

class VideoResponse(BaseModel):
    videos: List[Video]
