"""
Writes exam-style questions that read like the real thing

- Follows each exam's blueprint: one skill and difficulty per LLM call, skills mixed
  in roughly the official proportions and tilted toward the student's weak topics
- Shows the writer real College Board questions of the same skill and difficulty,
  and rejects anything that copies them
- Every wrong option must come from a named student mistake, as on the real test
- Checks each question against its skill's format rules, then arranges the options
  the way the real test does, so the key's position gives nothing away

Answer keys are not checked here; answer_check does that afterwards.
"""

import asyncio
import math
import random
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from src.services.answer_check import numeric_value
from src.services.llm import complete, llm_available
from src.services.question_sources import CollegeBoardSource, _matches_topic, normalize_text, section_label
from src.utils.math_text import to_plain

# Parallel LLM calls per question set, and questions per call
MAX_WRITE_CALLS = 6
MAX_PER_CALL = 8
EXAMPLES_PER_CALL = 3
PACE_DIFFICULTIES = {"quick": ["easy", "medium"], "deep": ["medium", "hard"]}
LETTERS = "ABCDE"


@dataclass(frozen=True)
class Skill:
    name: str
    domain: str
    weight: float
    format: str
    options: int = 4
    quick: bool = False
    stem_phrase: str = ""  # wording the real stem always uses
    passage_words: Optional[Tuple[int, int]] = None  # required passage length
    blank: bool = False  # the text has a blank to fill
    fixed_options: Tuple[str, ...] = ()  # answer choices that never change, in their real order


SAT_PASSAGE = (25, 150)
SAT_BLANK = 'The passage contains a blank written as "______". '
GRE_QC_OPTIONS = (
    "Quantity A is greater.",
    "Quantity B is greater.",
    "The two quantities are equal.",
    "The relationship cannot be determined from the information given.",
)
GRE_QC_FORMAT = (
    'Quantitative Comparison. Put any given information, then "Quantity A: ..." and "Quantity B: ..." on '
    'separate lines in "question". The options are always exactly these four, in this order: '
    + " | ".join(GRE_QC_OPTIONS)
)
GRE_MC_FORMAT = "Multiple choice, one correct answer, five options. Word problems and pure math both appear."


def _sat_math(name: str, domain: str, weight: float, note: str = "") -> Skill:
    return Skill(name, domain, weight, f"SAT Math multiple choice, four options. Self-contained, no figure. {note}".strip())


def _sat_rw(name: str, domain: str, weight: float, format: str, **kwargs) -> Skill:
    rules = "One short passage in \"passage\" (25-150 words, real-world academic or literary topic), one question about it."
    return Skill(name, domain, weight, f"{rules} {format}", passage_words=kwargs.pop("passage_words", SAT_PASSAGE), **kwargs)


BLUEPRINT: Dict[str, Dict[str, List[Skill]]] = {
    "sat": {
        "quant": [
            _sat_math("Linear equations in one variable", "Algebra", 7),
            _sat_math("Linear functions", "Algebra", 7),
            _sat_math("Linear equations in two variables", "Algebra", 7),
            _sat_math("Systems of two linear equations in two variables", "Algebra", 7),
            _sat_math("Linear inequalities in one or two variables", "Algebra", 7),
            _sat_math("Nonlinear functions", "Advanced Math", 13),
            _sat_math("Nonlinear equations in one variable and systems of equations in two variables", "Advanced Math", 11),
            _sat_math("Equivalent expressions", "Advanced Math", 11),
            _sat_math("Ratios, rates, proportional relationships, and units", "Problem-Solving and Data Analysis", 3),
            _sat_math("Percentages", "Problem-Solving and Data Analysis", 3),
            _sat_math("One-variable data: Distributions and measures of center and spread", "Problem-Solving and Data Analysis", 2,
                      "Give any data set in the text as a short list."),
            _sat_math("Probability and conditional probability", "Problem-Solving and Data Analysis", 2,
                      "A two-way table may be written as plain text rows."),
            _sat_math("Inference from sample statistics and margin of error", "Problem-Solving and Data Analysis", 2),
            _sat_math("Evaluating statistical claims: Observational studies and experiments", "Problem-Solving and Data Analysis", 1),
            _sat_math("Area and volume", "Geometry and Trigonometry", 4),
            _sat_math("Lines, angles, and triangles", "Geometry and Trigonometry", 4, "Describe the figure in words."),
            _sat_math("Right triangles and trigonometry", "Geometry and Trigonometry", 4),
            _sat_math("Circles", "Geometry and Trigonometry", 3),
        ],
        "verbal": [
            _sat_rw("Central Ideas and Details", "Information and Ideas", 8,
                    'Typical stem: "Which choice best states the main idea of the text?"'),
            _sat_rw("Command of Evidence", "Information and Ideas", 10,
                    "Textual evidence only (no tables or graphs). Typical stems: \"Which quotation from the poem most "
                    "effectively illustrates the claim?\" or \"Which finding, if true, would most directly support the "
                    "researcher's hypothesis?\""),
            _sat_rw("Inferences", "Information and Ideas", 8,
                    'The passage ends mid-thought with a blank. Stem: "Which choice most logically completes the text?"',
                    blank=True),
            _sat_rw("Words in Context", "Craft and Structure", 12, SAT_BLANK
                    + "The options are single words or short phrases.",
                    quick=True, blank=True, stem_phrase="most logical and precise word or phrase"),
            _sat_rw("Text Structure and Purpose", "Craft and Structure", 8,
                    'Typical stem: "Which choice best states the main purpose of the text?"'),
            _sat_rw("Cross-Text Connections", "Craft and Structure", 8,
                    'Two short texts, labeled "Text 1" and "Text 2", both in "passage". Typical stem: "Based on the '
                    'texts, how would the author of Text 2 most likely respond to ... in Text 1?"',
                    passage_words=(60, 220)),
            _sat_rw("Rhetorical Synthesis", "Expression of Ideas", 10,
                    'The passage is "While researching a topic, a student has taken the following notes:" then 4-6 '
                    'bullet points. Stem: "The student wants to [goal]. Which choice most effectively uses relevant '
                    'information from the notes to accomplish this goal?"',
                    passage_words=(40, 170), stem_phrase="most effectively uses relevant information from the notes"),
            _sat_rw("Transitions", "Expression of Ideas", 10, SAT_BLANK
                    + "The options are transition words or phrases (e.g. However, Similarly, For example).",
                    quick=True, blank=True, stem_phrase="most logical transition"),
            _sat_rw("Boundaries", "Standard English Conventions", 13, SAT_BLANK
                    + "The options differ only in punctuation around the blank.",
                    quick=True, blank=True, stem_phrase="conforms to the conventions of Standard English"),
            _sat_rw("Form, Structure, and Sense", "Standard English Conventions", 13, SAT_BLANK
                    + "The options differ in verb form, agreement, pronoun, or modifier.",
                    quick=True, blank=True, stem_phrase="conforms to the conventions of Standard English"),
        ],
    },
    "gre": {
        "quant": [
            Skill(f"Quantitative Comparison: {area}", area, 9, GRE_QC_FORMAT, quick=True, fixed_options=GRE_QC_OPTIONS)
            for area in ("Arithmetic", "Algebra", "Geometry", "Data Analysis")
        ] + [
            Skill(f"Multiple Choice: {area}", area, 16, GRE_MC_FORMAT, options=5)
            for area in ("Arithmetic", "Algebra", "Geometry", "Data Analysis")
        ],
        "verbal": [
            Skill("Text Completion", "Text Completion", 30,
                  'One to three sentences in "question" with one blank written as "______", and the stem ends with '
                  '"Select the best choice for the blank." Five single-word or short-phrase options, all the same part '
                  "of speech. Graduate-level vocabulary; the sentence's logic, not the word's rarity, decides the answer.",
                  options=5, quick=True, blank=True),
            Skill("Reading Comprehension", "Reading Comprehension", 45,
                  'One paragraph from an academic text in "passage" (80-200 words: science, social science, humanities, '
                  "or business), one question about main idea, detail, inference, or the author's attitude.",
                  options=5, passage_words=(80, 200)),
            Skill("Argument Analysis", "Reading Comprehension", 25,
                  'A short argument (40-120 words) in "passage". Stems like "Which of the following, if true, most '
                  'seriously weakens the argument?" or "The argument depends on which of the following assumptions?"',
                  options=5, passage_words=(40, 120)),
        ],
    },
}


def plan(exam: str, section: str, count: int, weak_topics: List[str], pace: Optional[str]) -> List[Tuple[Skill, str, int]]:
    """(skill, difficulty, how many) for each LLM call; weak topics are three times as likely to be picked"""
    skills = list(BLUEPRINT[exam][section])
    if section == "verbal" and pace == "quick":
        skills = [s for s in skills if s.quick]
    elif section == "verbal" and pace == "deep":
        skills = [s for s in skills if not s.quick]
    weights = [s.weight * (3 if any(_matches_topic(t, s.domain, s.name) for t in weak_topics) else 1) for s in skills]

    slots = min(len(skills), max(math.ceil(count / MAX_PER_CALL), min(count, MAX_WRITE_CALLS)))
    chosen = []
    for _ in range(slots):
        i = random.choices(range(len(skills)), weights)[0]
        chosen.append(skills.pop(i))
        weights.pop(i)

    difficulties = PACE_DIFFICULTIES.get(pace, ["easy", "medium", "hard"])
    offset = random.randrange(len(difficulties))
    return [
        (skill, difficulties[(offset + i) % len(difficulties)], min(MAX_PER_CALL, count // slots + (i < count % slots)))
        for i, skill in enumerate(chosen)
    ]


def _example_block(n: int, example: Dict) -> str:
    options = "\n".join(f"{LETTERS[i]}) {o}" for i, o in enumerate(example["options"]))
    passage = f"Passage: {example['passage']}\n" if example.get("passage") else ""
    why = example.get("explanation", "")[:500]
    return (
        f"--- EXAMPLE {n} ---\n{passage}Question: {example['stem']}\n{options}\n"
        f"Correct: {LETTERS[example['correctAnswer']]}\nWhy: {why}"
    )


def _prompt(exam: str, section: str, skill: Skill, difficulty: str, count: int, examples: List[Dict], pace_rule: str) -> str:
    from src.services.agent import ANSWER_VALUE_REQUIREMENT, EXPLANATION_REQUIREMENT, MATH_FORMAT_REQUIREMENT

    label = section_label(exam, section)
    example_text = ""
    if examples:
        example_text = (
            "\nREAL EXAMPLES from the official College Board question bank. Match their structure, stem wording, "
            "length, and difficulty. Never copy or paraphrase them: use a new topic, new numbers, a new passage.\n\n"
            + "\n\n".join(_example_block(i, e) for i, e in enumerate(examples, 1))
            + "\n"
        )
    option_rule = (
        f"- Use exactly these options, in this order: {' | '.join(skill.fixed_options)}"
        if skill.fixed_options
        else f"- Exactly {skill.options} options, parallel in form and similar in length; the correct one must not "
        "stand out as the longest, most detailed, or most hedged"
    )
    answer_value_field = ',\n    "answerValue": "..."' if section == "quant" else ""
    return f"""Write {count} original {label} questions.

SKILL: {skill.name} ({skill.domain})
DIFFICULTY: {difficulty}
FORMAT: {skill.format}
{example_text}
RULES:
- Each question tests {skill.name} at {difficulty} difficulty, the way the real exam does
{option_rule}
- Exactly one option is correct. Each wrong option is the answer a student gets from one specific mistake
  (a sign error, solving for the wrong quantity, a word that is close but too strong, a comma splice...).
  In "distractorRationales", one entry per option in order ("" for the correct one), tell a student who
  picked that option which mistake leads to it and why it's wrong, in one or two sentences
{EXPLANATION_REQUIREMENT}
{MATH_FORMAT_REQUIREMENT}
- Nothing that needs a figure, chart, or image. No "all of the above" or "none of the above"
- Vary topics and contexts across the questions
{pace_rule}
- "correctAnswer" is the 0-based index of the correct option
{ANSWER_VALUE_REQUIREMENT if section == "quant" else ""}
- Put any passage in "passage" and the question itself in "question"

FORMAT (JSON array):
[
  {{
    "passage": "",
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correctAnswer": 2,
    "distractorRationales": ["why option 1 is wrong", "why option 2 is wrong", "", "why option 4 is wrong"],
    "explanation": "Step 1: ...\\nStep 2: ...\\nSo the answer is ..."{answer_value_field}
  }}
]

Respond with the JSON array only:"""


def _shingles(text: str, size: int = 5) -> set:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {" ".join(words[i : i + size]) for i in range(len(words) - size + 1)}


def copies_example(question: Dict, examples: List[Dict]) -> bool:
    """True when much of the question's wording comes straight from one of the real examples"""
    mine = _shingles(question["question"])
    if len(mine) < 8:
        return False
    return any(len(mine & _shingles(e["question"])) / len(mine) >= 0.4 for e in examples)


def common_problem(question: Dict) -> Optional[str]:
    """A format problem any multiple-choice question can have, or None"""
    options = question["options"]
    if len({normalize_text(o) for o in options}) < len(options):
        return "repeated option"
    if any(re.search(r"\b(all|none|both) of (the )?(above|these)\b", o, re.IGNORECASE) for o in options):
        return "all/none of the above"
    correct = options[question["correctAnswer"]]
    others = [len(o) for i, o in enumerate(options) if i != question["correctAnswer"]]
    if len(correct) >= 25 and len(correct) > 1.6 * max(others):
        return "correct option stands out as the longest"
    return None


def skill_problem(question: Dict, skill: Skill) -> Optional[str]:
    """A way the question breaks its skill's format, or None"""
    options, passage, stem = question["options"], question.get("passage") or "", question["stem"]
    if skill.fixed_options:
        if [normalize_text(o) for o in options] != [normalize_text(o) for o in skill.fixed_options]:
            return "wrong fixed options"
        if "quantity a" not in stem.lower() or "quantity b" not in stem.lower():
            return "missing Quantity A or B"
    elif len(options) != skill.options:
        return f"{len(options)} options instead of {skill.options}"
    if skill.stem_phrase and skill.stem_phrase not in stem.lower():
        return "stem doesn't use the official wording"
    if skill.passage_words:
        low, high = skill.passage_words
        if not low <= len(passage.split()) <= high:
            return f"passage is {len(passage.split())} words, not {low}-{high}"
    if skill.blank and "___" not in passage + stem:
        return "no blank"
    return common_problem(question)


def arrange_options(question: Dict, fixed: bool = False) -> Dict:
    """
    Orders options like the real test: numbers ascending, anything else shuffled, fixed choices
    left alone. Generators put the key first far too often, and students learn that quickly.
    """
    if fixed:
        return question
    values = [numeric_value(o) for o in question["options"]]
    order = list(range(len(values)))
    if all(v is not None for v in values):
        order.sort(key=lambda i: values[i])
    else:
        random.shuffle(order)
    # Everything listed per option moves with its option
    for field in ("options", "optionsHtml", "optionExplanations"):
        if question.get(field):
            question[field] = [question[field][i] for i in order]
    question["correctAnswer"] = order.index(question["correctAnswer"])
    return question


async def _write_slot(exam: str, section: str, skill: Skill, difficulty: str, count: int, pace: Optional[str]) -> List[Dict]:
    from src.services.agent import PACE_REQUIREMENTS, ExamLearningAgent, extract_json

    examples = await CollegeBoardSource.examples(section, skill.name, difficulty, EXAMPLES_PER_CALL) if exam == "sat" else []
    prompt = _prompt(exam, section, skill, difficulty, count, examples, PACE_REQUIREMENTS.get(pace, ""))
    try:
        content = await asyncio.to_thread(
            complete,
            f"You are a senior item writer for the {exam.upper()}. Always respond with valid JSON.",
            prompt,
            effort="high",
            temperature=0.7,
            max_tokens=1500 + 900 * count,
        )
        raw_questions = extract_json(content, "[", "]")
    except Exception as e:
        print(f"Error writing {skill.name} questions: {e}")
        return []

    questions, rejected = [], []
    for raw in raw_questions if isinstance(raw_questions, list) else []:
        question = ExamLearningAgent._normalize_llm_question(raw, exam, section, [])
        if not question:
            rejected.append("unusable")
            continue
        rationales = raw.get("distractorRationales")
        if not isinstance(rationales, list) or len(rationales) != len(question["options"]) or any(
            not str(r).strip() for i, r in enumerate(rationales) if i != question["correctAnswer"]
        ):
            rejected.append("wrong options not explained")
            continue
        problem = skill_problem(question, skill) or ("copies a real question" if copies_example(question, examples) else None)
        if problem:
            rejected.append(problem)
            continue
        # Shown to a student who picks that option, in the review after a game
        question["optionExplanations"] = [to_plain(str(r).strip()) for r in rationales]
        if skill.fixed_options:
            question["options"], question["optionsHtml"] = list(skill.fixed_options), None
        question.update({"topic": skill.domain, "skill": skill.name, "difficulty": difficulty})
        questions.append(arrange_options(question, fixed=bool(skill.fixed_options)))
    if rejected:
        print(f"   ✂️  {skill.name}: dropped {len(rejected)} ({', '.join(sorted(set(rejected)))})")
    return questions


async def write_questions(exam: str, section: str, count: int, weak_topics: List[str], pace: Optional[str]) -> List[Dict]:
    """About `count` new questions across the exam's skills; answer keys still need checking"""
    if not llm_available() or count <= 0:
        return []
    slots = plan(exam, section, count, weak_topics, pace)
    print(f"   ✍️  Writing {count} questions: " + ", ".join(f"{n} {s.name} ({d})" for s, d, n in slots))
    results = await asyncio.gather(*(_write_slot(exam, section, s, d, n, pace) for s, d, n in slots))
    return [question for slot in results for question in slot]
