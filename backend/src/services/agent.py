from openai import OpenAI
from typing import List, Dict, Optional
import asyncio
import json
import os
import zlib
from src.config import OPENROUTER_API_KEY
from src.services.supabase_agent_ops import SupabaseAgentOps
from src.services.question_sources import (
    EXAMS,
    CollegeBoardSource,
    WebQuestionSource,
    is_quick_question,
    normalize_text,
    section_label,
)

LLM_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-haiku-4.5")
# One LLM call can't reliably return more questions than this
MAX_LLM_QUESTIONS = 25

PACE_REQUIREMENTS = {
    "quick": "- Only short questions a prepared student can answer in under 30 seconds: no long passages, no multi-step calculations, answer choices of a few words",
    "deep": "- Prefer questions that take real thought: reading passages, multi-step problems, medium and hard difficulty",
}

_client: Optional[OpenAI] = None

def get_llm_client() -> Optional[OpenAI]:
    """OpenRouter client (compatible with OpenAI API), or None when no API key is configured"""
    global _client
    if _client is None and OPENROUTER_API_KEY:
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
    return _client

def extract_json(content: str, open_char: str, close_char: str):
    """Parse the first JSON array/object found in an LLM response"""
    start_idx = content.find(open_char)
    end_idx = content.rfind(close_char) + 1
    if start_idx == -1 or end_idx <= start_idx:
        raise ValueError("No JSON found in response")
    return json.loads(content[start_idx:end_idx])

class ExamLearningAgent:
    """
    Adaptive SAT/GRE Learning Agent with Memory & Context
    - Analyzes user performance from Supabase
    - Identifies weak topics
    - Pulls real exam questions from the web, weighted toward weak topics
    - Fills gaps with exam-style questions from Claude Haiku 4.5
    - Maintains context of learning journey
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.context_memory = []
        print(f"🔗 Agent initialized for user {user_id}")
        
    def analyze_performance(self) -> Dict:
        """Analyzes user's historical performance from Supabase"""
        
        performance = SupabaseAgentOps.get_user_performance(self.user_id)
        topic_breakdown = SupabaseAgentOps.get_topic_performance(self.user_id)
        
        analysis = {
            "total_attempts": performance.get('total_attempts', 0),
            "recent_accuracy": performance.get('accuracy', 0),
            "topic_breakdown": topic_breakdown,
            "weak_topics": performance.get('weak_topics', []),
            "strong_topics": performance.get('strong_topics', []),
            "recommended_difficulty": "medium"
        }
        
        # Determine difficulty
        if analysis["recent_accuracy"] < 50:
            analysis["recommended_difficulty"] = "easy"
        elif analysis["recent_accuracy"] > 75:
            analysis["recommended_difficulty"] = "hard"
        
        return analysis
    
    def build_agent_context(self, analysis: Dict) -> str:
        """Builds context string for the AI agent"""
        
        context = f"""You are an adaptive SAT and GRE learning AI agent. Your goal is to help students improve their scores with personalized practice questions.

STUDENT PROFILE:
- Total Questions Attempted: {analysis['total_attempts']}
- Recent Accuracy: {analysis['recent_accuracy']:.1f}%
- Recommended Difficulty: {analysis['recommended_difficulty']}

WEAK TOPICS (Need Focus):
{', '.join(analysis['weak_topics']) if analysis['weak_topics'] else 'None identified yet'}

STRONG TOPICS (Can challenge more):
{', '.join(analysis['strong_topics']) if analysis['strong_topics'] else 'None identified yet'}

TOPIC PERFORMANCE:
"""
        for topic, data in analysis['topic_breakdown'].items():
            context += f"- {topic}: {data['accuracy']:.1f}% accuracy, {data['attempts']} attempts\n"
        
        return context
    
    async def generate_questions(
        self,
        num_questions: int = 50,
        use_web_search: bool = True,
        exam: str = "sat",
        section: str = "quant",
        pace: Optional[str] = None,
    ) -> List[Dict]:
        """
        Builds a personalized question set for one exam section.
        SAT questions come straight from the College Board question bank.
        GRE questions (and SAT, if the question bank is unreachable) are extracted
        from practice pages found by web search, topped up with AI-written ones.
        Every question carries a "source" of official, web, or ai.
        pace matches questions to the game: "quick" for fast games (short questions
        answerable in seconds), "deep" for slow ones (passages, multi-step problems).
        """
        analysis = await asyncio.to_thread(self.analyze_performance)
        weak_topics = analysis['weak_topics']
        if weak_topics:
            print(f"   📉 Focusing on weak topics: {', '.join(weak_topics[:3])}")

        questions: List[Dict] = []
        if exam == "sat":
            try:
                print(f"📚 Loading real {section_label(exam, section)} questions from College Board...")
                questions = await CollegeBoardSource.fetch(section, num_questions, weak_topics, pace)
                print(f"   ✅ Got {len(questions)} official questions")
            except Exception as e:
                print(f"   ⚠️  College Board question bank unavailable: {e}")

        missing = num_questions - len(questions)
        if missing > 0:
            questions += await self._questions_from_llm(exam, section, missing, analysis, use_web_search, pace)

        self.context_memory.append({
            "analysis": analysis,
            "exam": exam,
            "section": section,
            "generated_count": len(questions),
        })
        return questions

    async def _questions_from_llm(
        self, exam: str, section: str, count: int, analysis: Dict, use_web_search: bool, pace: Optional[str] = None
    ) -> List[Dict]:
        """Extracts real questions from web pages and writes exam-style ones for the remainder"""
        client = get_llm_client()
        if not client:
            print("   ℹ️  OPENROUTER_API_KEY not set - skipping web extraction and AI generation")
            return []

        count = min(count, MAX_LLM_QUESTIONS)
        label = section_label(exam, section)
        option_count = EXAMS[exam]["sections"][section]["option_count"]

        pages = []
        if use_web_search:
            print(f"🔍 Searching web for real {label} questions...")
            pages = await WebQuestionSource.find_pages(exam, section, analysis['weak_topics'][:1])

        sources = "".join(
            f"\n--- SOURCE {i} ({page['url']}) ---\n{page['text']}\n" for i, page in enumerate(pages, 1)
        )
        if sources:
            task = f"""TASK: Build a set of {count} {label} multiple-choice questions.

1. First, extract real practice questions from the SOURCES below. Copy the question, passage,
   and answer choices exactly as written. Only extract a question if the source also gives its
   correct answer. Set "sourceIndex" to the source number.
2. If the sources contain fewer than {count} usable questions, write original {label} questions
   in the official style for the remainder. Set "sourceIndex" to 0 for these.

SOURCES:
{sources}"""
        else:
            task = f"""TASK: Write {count} original {label} multiple-choice questions in the official style.
Set "sourceIndex" to 0 for all of them."""

        prompt = f"""{self.build_agent_context(analysis)}

{task}

REQUIREMENTS:
- Single-answer multiple choice with {option_count} options (4 is fine for GRE Quantitative Comparison)
- Match the real {label} question types, wording, and difficulty
- Mix easy, medium, and hard; lean toward the student's weak topics
- Skip anything that needs a figure, chart, or image
{PACE_REQUIREMENTS.get(pace, "")}
- "correctAnswer" is the 0-based index of the correct option
- Put any reading passage in "passage", not in "question"

QUESTION FORMAT (JSON array):
[
  {{
    "question": "If 2x + 5 = 15, what is the value of x?",
    "passage": "",
    "options": ["5", "10", "7.5", "3"],
    "correctAnswer": 0,
    "topic": "Algebra",
    "difficulty": "easy",
    "explanation": "2x + 5 = 15, subtract 5: 2x = 10, divide by 2: x = 5",
    "sourceIndex": 0
  }}
]

Respond with the JSON array only:"""

        print(f"   🤖 Calling {LLM_MODEL} via OpenRouter...")
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert SAT and GRE tutor AI that assembles practice question sets. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                max_tokens=12000
            )
            content = response.choices[0].message.content
            raw_questions = extract_json(content, '[', ']')
        except Exception as e:
            print(f"Error getting questions from LLM: {e}")
            return []

        questions = []
        for raw in raw_questions:
            question = self._normalize_llm_question(raw, exam, section, pages)
            if question and (pace != "quick" or is_quick_question(question)):
                questions.append(question)
        from_web = sum(1 for q in questions if q["source"] == "web")
        print(f"   ✅ {from_web} questions from the web, {len(questions) - from_web} AI-written")
        return questions

    @staticmethod
    def _normalize_llm_question(raw: Dict, exam: str, section: str, pages: List[Dict]) -> Optional[Dict]:
        """Validates an LLM question; it only counts as a web question if its text is on the page"""
        if not isinstance(raw, dict):
            return None
        stem = str(raw.get("question") or "").strip()
        passage = str(raw.get("passage") or "").strip()
        options = [str(o).strip() for o in raw.get("options") or []]
        correct = raw.get("correctAnswer")
        if not stem or not 2 <= len(options) <= 5 or not isinstance(correct, int) or not 0 <= correct < len(options):
            return None

        source, source_url, source_name = "ai", None, "AI-written practice question"
        source_index = raw.get("sourceIndex")
        if isinstance(source_index, int) and 1 <= source_index <= len(pages):
            page = pages[source_index - 1]
            page_text = normalize_text(page["text"])
            if normalize_text(stem)[:50] in page_text or (passage and normalize_text(passage)[:50] in page_text):
                source, source_url = "web", page["url"]
                source_name = page["url"].split("/")[2].replace("www.", "")

        difficulty = str(raw.get("difficulty") or "medium").lower()
        return {
            "id": zlib.crc32(stem.encode()) & 0x7FFFFFFF,
            "question": f"{passage}\n\n{stem}" if passage else stem,
            "options": options,
            "correctAnswer": correct,
            "topic": str(raw.get("topic") or "General"),
            "difficulty": difficulty if difficulty in ("easy", "medium", "hard") else "medium",
            "explanation": str(raw.get("explanation") or ""),
            "passage": passage,
            "stem": stem,
            "exam": exam,
            "section": section,
            "source": source,
            "sourceName": source_name,
            "sourceUrl": source_url,
        }
    
    def update_performance(self, question_attempts: List[Dict], game_data: Dict):
        """Updates user performance after game session in Supabase"""
        
        session_id = SupabaseAgentOps.save_game_session(self.user_id, game_data)
        if session_id:
            SupabaseAgentOps.save_question_attempts(session_id, self.user_id, question_attempts)
            SupabaseAgentOps.update_user_stats(self.user_id, game_data)
    
    async def get_learning_insights(self) -> Dict:
        """Generates personalized learning insights using AI"""
        
        analysis = self.analyze_performance()
        context = self.build_agent_context(analysis)
        
        prompt = f"""{context}

Based on this student's performance, provide:
1. Top 3 areas to focus on
2. Recommended study strategy
3. Motivational insight
4. Next milestone

Respond in JSON:
{{
  "focus_areas": ["area1", "area2", "area3"],
  "strategy": "Study strategy text",
  "motivation": "Motivational message",
  "next_milestone": "Goal description"
}}
"""
        
        try:
            response = get_llm_client().chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": "You are a supportive SAT and GRE learning coach."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=500
            )
            return extract_json(response.choices[0].message.content, '{', '}')
        except Exception:
            return {
                "focus_areas": analysis['weak_topics'][:3] if analysis['weak_topics'] else ["Keep practicing!"],
                "strategy": "Continue playing games to identify your strengths and weaknesses.",
                "motivation": "You're on the right track!",
                "next_milestone": "Complete 50 more questions"
            }

