"""
Math in LLM-written questions, made to look like it does in official ones

The writer puts math in LaTeX between single dollar signs ($\\frac{3}{4}$, $x^{2}$).
Each field becomes two versions, the same pair official questions arrive with:
- HTML with MathML, sanitized, for the screens that render it
- readable plain text (3/4, x^2, √(2)), for canvas labels and answer checking
"""

import re
from html import escape
from typing import Optional

from latex2mathml.converter import convert

from src.utils.html_utils import html_to_text, sanitize_html

# $...$ with no space just inside either sign, so "costs $5 and $7" isn't math
MATH = re.compile(r"\$(?=\S)([^$\n]*?\S)\$")
ESCAPED_DOLLAR = "\x00"


def has_math(text: str) -> bool:
    return bool(text) and bool(MATH.search(text.replace("\\$", ESCAPED_DOLLAR)))


def to_html(text: str) -> str:
    """Sanitized HTML: math as MathML, line breaks kept"""
    text = text.replace("\\$", ESCAPED_DOLLAR)
    parts, position = [], 0
    for match in MATH.finditer(text):
        parts.append(escape(text[position : match.start()]))
        try:
            parts.append(convert(match.group(1), display="inline"))
        except Exception:
            parts.append(escape(match.group(1)))
        position = match.end()
    parts.append(escape(text[position:]))
    html = "".join(parts).replace(ESCAPED_DOLLAR, "$")
    paragraphs = [p.strip().replace("\n", "<br>") for p in re.split(r"\n\s*\n", html) if p.strip()]
    return sanitize_html("".join(f"<p>{p}</p>" for p in paragraphs))


def to_plain(text: str) -> str:
    """Readable text with the LaTeX turned into plain math"""
    if not has_math(text):
        return text.replace("\\$", "$")
    return "\n".join(html_to_text(to_html(line)) if has_math(line) else line.replace("\\$", "$") for line in text.split("\n"))


def html_if_math(text: str) -> Optional[str]:
    """HTML for text with math in it, None when plain text shows it just as well"""
    return to_html(text) if has_math(text) else None
