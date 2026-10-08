"""
Checks the answer key of LLM-written and LLM-extracted questions before students see them

A well-formatted question with a wrong key does more harm than no question, because
students trust the key over their own work. Two checks, cheapest first:

- answer_value_matches: for math, the generator also states the answer's value. Exactly
  one option must equal it, and it must be the keyed one. No LLM call.
- verify_answer_keys: a separate model solves each question blind (no key, no
  explanation, options shuffled) several times. A question survives only if most
  solves land on the key and few find another option defensible. Anything the
  check can't confirm is dropped.
"""

import ast
import asyncio
import math
import operator
import random
import re
from typing import Dict, List, Optional

from src.services.llm import PROVIDER, VERIFIER_MODEL, complete, llm_available

VERIFY_SAMPLES = 3
# Solves that must agree with the key, and the most that may find another option defensible
VERIFY_MIN_AGREE = 2
VERIFY_MAX_AMBIGUOUS = 1
LETTERS = "ABCDE"

_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        value = _eval_node(node.operand)
        return -value if isinstance(node.op, ast.USub) else value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
        left, right = _eval_node(node.left), _eval_node(node.right)
        if isinstance(node.op, ast.Pow) and (abs(right) > 12 or abs(left) > 1e6):
            raise ValueError("Exponent too large")
        return _OPERATORS[type(node.op)](left, right)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "sqrt" and len(node.args) == 1:
        return math.sqrt(_eval_node(node.args[0]))
    if isinstance(node, ast.Name) and node.id == "pi":
        return math.pi
    raise ValueError("Not a plain number")


def numeric_value(text) -> Optional[float]:
    """The value of a plain numeric answer like "7.5", "3/4", "2√3", or "-π/2"; None for anything else"""
    if text is None or isinstance(text, bool):
        return None
    expr = str(text).strip().rstrip(".")
    if "\\" in expr:
        from src.utils.math_text import to_plain

        expr = to_plain(f"${expr.strip('$')}$")
    # "x = 5" and "$1,200" are still numeric answers
    expr = re.sub(r"^[a-zA-Z]\s*=\s*", "", expr)
    expr = expr.replace("$", "").replace(",", "").replace("−", "-").replace("^", "**").replace("π", "pi")
    expr = re.sub(r"√\s*\(", "sqrt(", expr)
    expr = re.sub(r"√\s*(\d+(?:\.\d+)?)", r"sqrt(\1)", expr)
    expr = re.sub(r"(\d|\))\s*(sqrt|pi|\()", r"\1*\2", expr)
    expr = re.sub(r"(\d+(?:\.\d+)?)\s*%$", r"(\1/100)", expr)
    if not expr or len(expr) > 40:
        return None
    try:
        value = _eval_node(ast.parse(expr, mode="eval").body)
    except (SyntaxError, ValueError, ZeroDivisionError, OverflowError, TypeError):
        return None
    return value if math.isfinite(value) else None


def _same(a: float, b: float) -> bool:
    return math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-9)


def answer_value_matches(options: List[str], correct: int, answer_value) -> bool:
    """
    False when the stated answer value contradicts the key: the keyed option has a different
    value, or another option has the same value. True when the check can't apply.
    """
    value = numeric_value(answer_value)
    keyed = numeric_value(options[correct])
    if value is None or keyed is None:
        return True
    if not _same(value, keyed):
        return False
    return not any(
        i != correct and (other := numeric_value(option)) is not None and _same(other, value)
        for i, option in enumerate(options)
    )


def _question_text(question: Dict) -> str:
    passage = question.get("passage") or ""
    stem = question.get("stem") or question["question"]
    return f"{passage}\n\n{stem}" if passage else stem


async def _blind_solve(questions: List[Dict], label: str, seed: int) -> Dict[int, Dict]:
    """One blind pass over every question, options shuffled; votes mapped back to original option indexes"""
    rng = random.Random(seed)
    orders = [rng.sample(range(len(q["options"])), len(q["options"])) for q in questions]
    blocks = []
    for n, (question, order) in enumerate(zip(questions, orders), 1):
        options = "\n".join(f"{LETTERS[i]}) {question['options'][original]}" for i, original in enumerate(order))
        blocks.append(f"--- QUESTION {n} ---\n{_question_text(question)}\n{options}")

    # Claude reasons in its thinking, so written-out working would only add output tokens
    work_field = "" if PROVIDER == "anthropic" else '"work": "two or three sentences of working", '
    prompt = f"""Solve each {label} question below on its own. Work it out carefully, then choose the single best answer.
Also list any other option that a careful expert could reasonably defend as correct. Usually there are none.

{chr(10).join(blocks)}

FORMAT (JSON array, one entry per question):
[{{"id": 1, {work_field}"answer": "B", "alsoDefensible": []}}]

Respond with the JSON array only:"""

    # Imported here to avoid a circular import; agent.py imports this module
    from src.services.agent import extract_json

    try:
        content = await asyncio.to_thread(
            complete,
            "You are a meticulous exam answer checker. Always respond with valid JSON.",
            prompt,
            effort="high",
            temperature=0.7,
            max_tokens=min(16000, 400 + 250 * len(questions)),
            model=VERIFIER_MODEL,
        )
        solved = extract_json(content, "[", "]")
    except Exception as e:
        print(f"Error checking answer keys: {e}")
        return {}

    def original_index(letter, order) -> Optional[int]:
        i = LETTERS.find(str(letter).strip().upper()[:1]) if letter else -1
        return order[i] if 0 <= i < len(order) else None

    votes = {}
    for entry in solved if isinstance(solved, list) else []:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), int) or not 1 <= entry["id"] <= len(questions):
            continue
        order = orders[entry["id"] - 1]
        defensible = entry.get("alsoDefensible") if isinstance(entry.get("alsoDefensible"), list) else []
        votes[entry["id"] - 1] = {
            "answer": original_index(entry.get("answer"), order),
            "others": {original_index(letter, order) for letter in defensible} - {None},
        }
    return votes


async def verify_answer_keys(questions: List[Dict], label: str) -> List[Dict]:
    """
    The questions whose keys hold up under independent blind solving; everything else is dropped.
    Solves run only while they can still change a question's outcome: the first
    VERIFY_MIN_AGREE run together, then one more at a time for the questions still undecided.
    The result is the same as running all VERIFY_SAMPLES on every question.
    """
    if not questions or not llm_available():
        return []

    solves: Dict[int, List[Dict]] = {i: [] for i in range(len(questions))}
    outcome: Dict[int, bool] = {}
    seeds = random.sample(range(1 << 30), VERIFY_SAMPLES)
    done = 0
    while done < VERIFY_SAMPLES and len(outcome) < len(questions):
        batch = VERIFY_MIN_AGREE if done == 0 else 1
        open_ids = [i for i in range(len(questions)) if i not in outcome]
        subset = [questions[i] for i in open_ids]
        passes = await asyncio.gather(*(_blind_solve(subset, label, seed) for seed in seeds[done : done + batch]))
        done += batch
        for votes in passes:
            for j, vote in votes.items():
                solves[open_ids[j]].append(vote)

        remaining = VERIFY_SAMPLES - done
        for i in open_ids:
            key = questions[i]["correctAnswer"]
            agree = sum(1 for s in solves[i] if s["answer"] == key)
            # Another option counts against the question if a solver chose it or defended it
            ambiguous = sum(1 for s in solves[i] if (s["others"] | {s["answer"]}) - {key, None})
            if agree >= VERIFY_MIN_AGREE and ambiguous + remaining <= VERIFY_MAX_AMBIGUOUS:
                outcome[i] = True
            elif agree + remaining < VERIFY_MIN_AGREE or ambiguous > VERIFY_MAX_AMBIGUOUS:
                outcome[i] = False

    verified = [q for i, q in enumerate(questions) if outcome.get(i)]
    print(f"   🔎 Answer check kept {len(verified)} of {len(questions)} questions ({done} solving passes)")
    return verified
