"""
Turns uploaded study material into practice questions

- extract_text: reads the text out of a PDF or text file
- parse_questions: finds multiple-choice questions written in the usual
  numbered format, with their answers if the material includes them
- questions_from_llm: for material the parser can't handle, lets the LLM
  extract the questions that are in it, and optionally write new ones from it
"""

import asyncio
import io
import re
from typing import Dict, List, Optional

from src.services.answer_check import answer_value_matches, verify_answer_keys
from src.services.question_sources import normalize_text, section_label
from src.services.question_writer import arrange_options, common_problem
from src.utils.math_text import to_plain

LETTERS = "ABCDE"
MAX_TEXT_CHARS = 400_000
# How much material one LLM call reads
LLM_CHUNK_CHARS = 12_000
MAX_LLM_CHUNKS = 4

QUESTION_START = re.compile(r"^\s*(?:Question\s+)?(\d{1,3})\s*[.):]\s+(\S.*)$", re.IGNORECASE)
OPTION_START = re.compile(r"^\s*\(?([A-Ea-e])[.)]\s+(\S.*)$")
ANSWER_LINE = re.compile(r"^\s*(?:Correct\s+)?Answer\s*(?:is)?\s*[:\-]?\s*\(?([A-Ea-e])\)?(?:[.)\s]|$)", re.IGNORECASE)
EXPLANATION_LINE = re.compile(r"^\s*(?:Explanation|Solution|Rationale)\s*[:\-]\s*(.*)$", re.IGNORECASE)
ANSWER_KEY_HEADING = re.compile(r"^\s*(?:Answer\s+Key|Answers)\s*:?\s*$", re.IGNORECASE)
ANSWER_KEY_ENTRY = re.compile(r"(\d{1,3})\s*[.):\-]?\s*\(?([A-Ea-e])\)?(?=\s|,|;|$)")


def extract_text(filename: str, content: bytes) -> str:
    """Text of an uploaded PDF or plain-text file"""
    if filename.lower().endswith(".pdf") or content[:5] == b"%PDF-":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = content.decode("utf-8", errors="replace")
    return text[:MAX_TEXT_CHARS]


def _new_question(number: int, stem: str) -> Dict:
    return {"number": number, "stem": [stem], "options": [], "answer": None, "explanation": []}


def parse_questions(text: str) -> List[Dict]:
    """
    Multiple-choice questions written as "1. ..." followed by "A) ..." choices.
    Answers come from an "Answer: C" line under the question or from an
    answer key at the end; correctAnswer is None when neither is present.
    """
    lines = text.splitlines()
    answer_key: Dict[int, str] = {}
    for i, line in enumerate(lines):
        if ANSWER_KEY_HEADING.match(line):
            for number, letter in ANSWER_KEY_ENTRY.findall("\n".join(lines[i + 1 :])):
                answer_key.setdefault(int(number), letter.upper())
            lines = lines[:i]
            break

    parsed: List[Dict] = []
    current: Optional[Dict] = None
    # Which part of the current question a continuation line belongs to
    part = "stem"
    for line in lines:
        if not line.strip():
            continue
        answer = ANSWER_LINE.match(line)
        option = OPTION_START.match(line)
        start = QUESTION_START.match(line)
        explanation = EXPLANATION_LINE.match(line)

        if current and answer:
            current["answer"] = answer.group(1).upper()
            part = "explanation"
        elif current and explanation:
            current["explanation"].append(explanation.group(1))
            part = "explanation"
        elif current and option and LETTERS.index(option.group(1).upper()) == len(current["options"]):
            current["options"].append(option.group(2).strip())
            part = "options"
        elif start and (current is None or current["options"]):
            current = _new_question(int(start.group(1)), start.group(2).strip())
            parsed.append(current)
            part = "stem"
        elif current and part == "stem":
            current["stem"].append(line.strip())
        elif current and part == "options" and current["options"]:
            current["options"][-1] += " " + line.strip()
        elif current and part == "explanation":
            current["explanation"].append(line.strip())

    questions = []
    for item in parsed:
        if not 2 <= len(item["options"]) <= 5:
            continue
        letter = item["answer"] or answer_key.get(item["number"])
        correct = LETTERS.index(letter) if letter else None
        if correct is not None and correct >= len(item["options"]):
            correct = None
        questions.append({
            "question": " ".join(item["stem"]),
            "passage": "",
            "options": item["options"],
            "correctAnswer": correct,
            "explanation": " ".join(item["explanation"]).strip(),
            "origin": "extracted",
        })
    return questions


async def questions_from_llm(text: str, exam: str, section: str, generate: bool) -> List[Dict]:
    """
    Questions the LLM finds in the material, plus new ones written from it when
    generate is set. Returns nothing if no LLM is configured.
    """
    # Imported here so parsing still works where the agent's dependencies aren't set up
    from src.services.agent import ANSWER_VALUE_REQUIREMENT, EXPLANATION_REQUIREMENT, MATH_FORMAT_REQUIREMENT, extract_json
    from src.services.llm import complete, llm_available

    if not llm_available():
        return []

    label = section_label(exam, section)
    if generate:
        generate_task = (
            f"3. Then write up to 8 original {label} multiple-choice questions that test what this material teaches. "
            'Set "fromMaterial" to false for these.'
            f"\n   For these, {EXPLANATION_REQUIREMENT.lstrip('- ')}"
            f"\n   {MATH_FORMAT_REQUIREMENT.lstrip('- ')}"
        )
        if section == "quant":
            generate_task += f"\n   For these, {ANSWER_VALUE_REQUIREMENT.lstrip('- ')}"
    else:
        generate_task = "3. Do not write any questions of your own."
    chunks = [text[i : i + LLM_CHUNK_CHARS] for i in range(0, len(text), LLM_CHUNK_CHARS)][:MAX_LLM_CHUNKS]

    async def read_chunk(chunk: str) -> List[Dict]:
        prompt = f"""You are preparing {label} practice questions from a student's own study material.

1. Extract every multiple-choice question that appears in the MATERIAL. Copy the question, any passage,
   and the answer choices exactly as written. Set "fromMaterial" to true.
2. Set "correctAnswer" to the 0-based index of the correct choice only if the material states the answer.
   Otherwise use null. Never guess an answer for an extracted question.
{generate_task}

Skip anything that needs a figure, chart, or image.

FORMAT (JSON array):
[
  {{
    "question": "If 2x + 5 = 15, what is the value of x?",
    "passage": "",
    "options": ["5", "10", "7.5", "3"],
    "correctAnswer": 0,
    "topic": "Algebra",
    "difficulty": "easy",
    "explanation": "Subtract 5, then divide by 2.",
    "answerValue": "5",
    "fromMaterial": true
  }}
]

MATERIAL:
{chunk}

Respond with the JSON array only:"""
        try:
            content = await asyncio.to_thread(
                complete,
                "You turn study material into practice questions. Always respond with valid JSON.",
                prompt,
                effort="medium",
                temperature=0.3,
            )
            raw_questions = extract_json(content, "[", "]")
        except Exception as e:
            print(f"Error reading material with LLM: {e}")
            return []

        chunk_text = normalize_text(chunk)
        questions = []
        for raw in raw_questions:
            question = _normalize_llm_question(raw, chunk_text)
            if question:
                questions.append(question)
        return questions

    results = await asyncio.gather(*(read_chunk(chunk) for chunk in chunks))
    questions = [question for chunk_questions in results for question in chunk_questions]
    # Extracted questions keep the material's own key; only AI-written keys need checking
    extracted = [q for q in questions if q["origin"] == "extracted"]
    generated = [arrange_options(q) for q in questions if q["origin"] == "generated" and not common_problem(q)]
    return extracted + await verify_answer_keys(generated, label)


def _normalize_llm_question(raw: Dict, chunk_text: str) -> Optional[Dict]:
    """Validates an LLM question; it only counts as extracted if its text is in the material"""
    if not isinstance(raw, dict):
        return None
    # Uploaded questions are stored and edited as text, so any LaTeX becomes readable plain math
    stem = to_plain(str(raw.get("question") or "").strip())
    options = [to_plain(str(o).strip()) for o in raw.get("options") or []]
    if not stem or not 2 <= len(options) <= 5:
        return None
    correct = raw.get("correctAnswer")
    if not isinstance(correct, int) or isinstance(correct, bool) or not 0 <= correct < len(options):
        correct = None

    is_extracted = bool(raw.get("fromMaterial")) and normalize_text(stem)[:50] in chunk_text
    # A generated question is useless without its answer, or with one its own math contradicts
    if not is_extracted and (correct is None or not answer_value_matches(options, correct, raw.get("answerValue"))):
        return None
    difficulty = str(raw.get("difficulty") or "medium").lower()
    return {
        "question": stem,
        "passage": to_plain(str(raw.get("passage") or "").strip()),
        "options": options,
        "correctAnswer": correct,
        "topic": str(raw.get("topic") or "").strip(),
        "difficulty": difficulty if difficulty in ("easy", "medium", "hard") else "medium",
        "explanation": to_plain(str(raw.get("explanation") or "").strip()),
        "origin": "extracted" if is_extracted else "generated",
    }


def merge_questions(parsed: List[Dict], from_llm: List[Dict]) -> List[Dict]:
    """Parsed questions first, then LLM questions that aren't the same question again"""
    seen = {normalize_text(q["question"])[:60] for q in parsed}
    merged = list(parsed)
    for question in from_llm:
        key = normalize_text(question["question"])[:60]
        if key not in seen:
            seen.add(key)
            merged.append(question)
    return merged
