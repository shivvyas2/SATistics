from typing import List, Dict, Optional
import asyncio
import json
import math
import zlib
from src.services.llm import LLM_MODEL, PROVIDER, complete, llm_available
from src.services.supabase_agent_ops import SupabaseAgentOps
from src.services.answer_check import answer_value_matches, verify_answer_keys
from src.services import question_pool
from src.services.question_writer import write_questions
from src.utils.math_text import has_math, html_if_math, to_plain
from src.services.question_sources import (
    CollegeBoardSource,
    WebQuestionSource,
    is_quick_question,
    normalize_text,
    section_label,
)

# One LLM call can't reliably return more questions than this
MAX_LLM_QUESTIONS = 25
# Extra questions to ask for, since the answer check drops some
VERIFY_HEADROOM = 1.4

ANSWER_VALUE_REQUIREMENT = (
    '- "answerValue" is the exact value of the correct answer as a plain expression '
    '(like 5, 3/4, or sqrt(2)/2), worked out independently of the options; null if the answer is not a number'
)

EXPLANATION_REQUIREMENT = (
    '- "explanation" is a worked solution a student can learn from: numbered steps on separate lines '
    '("Step 1: ..."), each naming the rule or formula it uses and showing the work, ending with the answer. '
    "For reading and writing questions, quote the words in the text that decide the answer and say why"
)

MATH_FORMAT_REQUIREMENT = (
    "- Write all math (formulas, expressions, equations, fractions, exponents, roots) in LaTeX between single "
    "dollar signs, like $\\frac{3}{4}$, $x^{2} - 5x + 6 = 0$, or $2\\sqrt{3}$, in the question, options, and "
    'explanation. Write money as \\$12 or in words, never with a bare dollar sign'
)

PACE_REQUIREMENTS = {
    "quick": "- Only short questions a prepared student can answer in under 30 seconds: no long passages, no multi-step calculations, answer choices of a few words",
    "deep": "- Prefer questions that take real thought: reading passages, multi-step problems, medium and hard difficulty",
}

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
        wait_for_ai: bool = False,
    ) -> List[Dict]:
        """
        Builds a personalized question set for one exam section.
        SAT questions come straight from the College Board question bank, then checked
        AI-written questions from the shared pool. Writing new questions takes a minute, so by
        default the set comes back short instead and the caller refills the pool separately
        (refill_pool). With wait_for_ai, the rest is found on the web and written here.
        Every question carries a "source" of official, web, or ai.
        pace matches questions to the game: "quick" for fast games (short questions
        answerable in seconds), "deep" for slow ones (passages, multi-step problems).
        """
        # Load the College Board index while the student's history is read
        warming = asyncio.create_task(CollegeBoardSource.warm(section)) if exam == "sat" else None
        analysis = await asyncio.to_thread(self.analyze_performance)
        if warming:
            await warming
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
            questions += await asyncio.to_thread(
                question_pool.load, self.user_id, exam, section, missing, weak_topics, pace
            )

        missing = num_questions - len(questions)
        if missing > 0 and wait_for_ai:
            fresh = await self._questions_from_llm(exam, section, missing, analysis, use_web_search, pace)
            # Every checked question is pooled, including the extras this set doesn't need
            await asyncio.to_thread(question_pool.save, fresh)
            questions += fresh[:missing]

        self.context_memory.append({
            "analysis": analysis,
            "exam": exam,
            "section": section,
            "generated_count": len(questions),
        })
        return questions

    async def refill_pool(self, exam: str, section: str, pace: Optional[str], count: int) -> int:
        """Writes and checks new questions for the shared pool; returns how many passed"""
        if not llm_available():
            return 0
        analysis = await asyncio.to_thread(self.analyze_performance)
        written = await write_questions(
            exam, section, min(math.ceil(count * VERIFY_HEADROOM), MAX_LLM_QUESTIONS), analysis['weak_topics'], pace
        )
        written = [q for q in written if pace != "quick" or is_quick_question(q)]
        checked = await verify_answer_keys(written, section_label(exam, section))
        await asyncio.to_thread(question_pool.save, checked)
        return len(checked)

    async def _questions_from_llm(
        self, exam: str, section: str, count: int, analysis: Dict, use_web_search: bool, pace: Optional[str] = None
    ) -> List[Dict]:
        """Extracts real questions from web pages, writes exam-style ones for the remainder, and checks every key"""
        if not llm_available():
            print("   ℹ️  No ANTHROPIC_API_KEY or OPENROUTER_API_KEY - skipping web extraction and AI generation")
            return []

        label = section_label(exam, section)
        extracted = []
        if use_web_search:
            print(f"🔍 Searching web for real {label} questions...")
            pages = await WebQuestionSource.find_pages(exam, section, analysis['weak_topics'][:1])
            extracted = await self._extract_from_pages(exam, section, pages, analysis, pace)

        # The format and answer checks drop some, so write extra
        missing = max(0, count - len(extracted))
        written = await write_questions(
            exam, section, min(math.ceil(missing * VERIFY_HEADROOM), MAX_LLM_QUESTIONS), analysis['weak_topics'], pace
        )
        written = [q for q in written if pace != "quick" or is_quick_question(q)]

        # Extracted keys are the LLM's reading of the page, so they're checked too.
        # More than `count` can pass; the caller pools the extras
        questions = await verify_answer_keys(extracted + written, label)
        from_web = sum(1 for q in questions if q["source"] == "web")
        print(f"   ✅ {from_web} questions from the web, {len(questions) - from_web} AI-written")
        return questions

    async def _extract_from_pages(
        self, exam: str, section: str, pages: List[Dict], analysis: Dict, pace: Optional[str]
    ) -> List[Dict]:
        """Practice questions copied from the pages, only those whose text really is on the page"""
        if not pages:
            return []
        label = section_label(exam, section)
        sources = "".join(
            f"\n--- SOURCE {i} ({page['url']}) ---\n{page['text']}\n" for i, page in enumerate(pages, 1)
        )
        prompt = f"""{self.build_agent_context(analysis)}

TASK: Extract up to {MAX_LLM_QUESTIONS} real {label} multiple-choice questions from the SOURCES below.
Copy the question, passage, and answer choices exactly as written. Only extract a question if the source
also gives its correct answer. Set "sourceIndex" to the source number. Do not write questions of your own.

REQUIREMENTS:
- Single-answer multiple choice only
- Prefer the student's weak topics
- Skip anything that needs a figure, chart, or image
{PACE_REQUIREMENTS.get(pace, "")}
- "correctAnswer" is the 0-based index of the correct option
{ANSWER_VALUE_REQUIREMENT if section == "quant" else ""}
- Copy the source's explanation when it has one. Otherwise write one:
  {EXPLANATION_REQUIREMENT.lstrip('- ')}
- Put any reading passage in "passage", not in "question"

SOURCES:
{sources}

QUESTION FORMAT (JSON array):
[
  {{
    "question": "If 2x + 5 = 15, what is the value of x?",
    "passage": "",
    "options": ["5", "10", "7.5", "3"],
    "correctAnswer": 0,
    "topic": "Algebra",
    "difficulty": "easy",
    "explanation": "Step 1: Subtract 5 from both sides: 2x = 10.\\nStep 2: Divide both sides by 2: x = 5.",
    "answerValue": "5",
    "sourceIndex": 1
  }}
]

Respond with the JSON array only:"""

        print(f"   🤖 Extracting questions with {LLM_MODEL} via {PROVIDER}...")
        try:
            content = await asyncio.to_thread(
                complete,
                "You are an expert SAT and GRE tutor AI that assembles practice question sets. Always respond with valid JSON.",
                prompt,
                effort="low",
                temperature=0.2,
            )
            raw_questions = extract_json(content, '[', ']')
        except Exception as e:
            print(f"Error extracting questions from the web: {e}")
            return []

        questions = []
        for raw in raw_questions:
            question = self._normalize_llm_question(raw, exam, section, pages)
            # Anything the model wrote itself goes through the question writer instead
            if question and question["source"] == "web" and (pace != "quick" or is_quick_question(question)):
                questions.append(question)
        return questions

    @staticmethod
    def _normalize_llm_question(raw: Dict, exam: str, section: str, pages: List[Dict]) -> Optional[Dict]:
        """Validates an LLM question; it only counts as a web question if its text is on the page"""
        if not isinstance(raw, dict):
            return None
        # Math arrives as LaTeX; the plain versions are what games draw and checks compare
        raw_stem = str(raw.get("question") or "").strip()
        raw_passage = str(raw.get("passage") or "").strip()
        raw_options = [str(o).strip() for o in raw.get("options") or []]
        raw_explanation = str(raw.get("explanation") or "").strip()
        stem, passage, options = to_plain(raw_stem), to_plain(raw_passage), [to_plain(o) for o in raw_options]
        correct = raw.get("correctAnswer")
        if not stem or not 2 <= len(options) <= 5 or not isinstance(correct, int) or not 0 <= correct < len(options):
            return None
        if not answer_value_matches(options, correct, raw.get("answerValue")):
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
            "explanation": to_plain(raw_explanation),
            "passage": passage,
            "stem": stem,
            "questionHtml": html_if_math(raw_stem),
            "passageHtml": html_if_math(raw_passage),
            "optionsHtml": [html_if_math(o) or "" for o in raw_options] if any(map(has_math, raw_options)) else None,
            "explanationHtml": html_if_math(raw_explanation),
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
            content = complete(
                "You are a supportive SAT and GRE learning coach.",
                prompt,
                effort="low",
                temperature=0.8,
                max_tokens=500,
            )
            return extract_json(content, '{', '}')
        except Exception:
            return {
                "focus_areas": analysis['weak_topics'][:3] if analysis['weak_topics'] else ["Keep practicing!"],
                "strategy": "Continue playing games to identify your strengths and weaknesses.",
                "motivation": "You're on the right track!",
                "next_milestone": "Complete 50 more questions"
            }

