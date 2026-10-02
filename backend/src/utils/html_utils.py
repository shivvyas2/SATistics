"""
HTML helpers for question content pulled from the web.

Real exam questions arrive as HTML with MathML. Games need two forms of it:
- sanitized HTML (allowlisted tags only) for rich rendering
- readable plain text for games that draw text themselves
"""

from html import escape
from html.parser import HTMLParser
from typing import List, Optional, Union
import re

HTML_TAGS = {
    "p", "br", "span", "div", "b", "strong", "i", "em", "u", "sup", "sub",
    "ul", "ol", "li", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td", "caption",
}
MATH_TAGS = {
    "math", "mrow", "mi", "mn", "mo", "mtext", "mspace", "mfrac", "msqrt", "mroot",
    "msup", "msub", "msubsup", "munder", "mover", "munderover",
    "mtable", "mtr", "mtd", "mstyle", "mpadded", "mphantom", "menclose",
}
MATH_TOKEN_TAGS = {"mi", "mn", "mo", "mtext"}
# Removed together with everything inside them
DROPPED_TAGS = {
    "script", "style", "svg", "figure", "img", "iframe", "object", "embed",
    "annotation", "annotation-xml", "noscript", "head", "nav", "footer", "form", "button",
}
FIGURE_TAGS = {"svg", "img", "figure"}
VOID_TAGS = {"br", "hr", "img", "mspace", "input", "meta", "link"}
BLOCK_TAGS = {"p", "div", "li", "tr", "blockquote", "table", "ul", "ol", "caption", "h1", "h2", "h3", "h4", "section", "article"}
KEPT_ATTRS = {"alttext", "display", "mathvariant", "colspan", "rowspan", "columnalign", "linethickness"}
BINARY_OPERATORS = set("=+-−<>≤≥≠±×÷·")


class Node:
    def __init__(self, tag: str, attrs: Optional[dict] = None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children: List[Union["Node", str]] = []


class _TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, {k: (v or "") for k, v in attrs})
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, {k: (v or "") for k, v in attrs}))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse_html(html: str) -> Node:
    builder = _TreeBuilder()
    builder.feed(html or "")
    builder.close()
    return builder.root


def _is_screen_reader_only(node: Node) -> bool:
    return "sr-only" in node.attrs.get("class", "")


def _element_children(node: Node) -> List[Node]:
    return [c for c in node.children if isinstance(c, Node)]


def has_figure(html: str) -> bool:
    """True if the content relies on an image or drawn figure"""
    def walk(node: Node) -> bool:
        return any(isinstance(c, Node) and (c.tag in FIGURE_TAGS or walk(c)) for c in node.children)
    return walk(parse_html(html))


# ---------- Sanitized HTML ----------

def _render_html(node: Union[Node, str], in_math: bool = False) -> str:
    if isinstance(node, str):
        # Whitespace between MathML elements is only source formatting
        if in_math and not node.strip():
            return ""
        return escape(node, quote=False)

    tag = node.tag
    if tag in DROPPED_TAGS or _is_screen_reader_only(node):
        return ""

    if tag == "mfenced":
        # Browsers no longer render <mfenced>; expand it into explicit brackets
        separator = (node.attrs.get("separators", ",") or ",")[0]
        parts = [_render_html(c, True) for c in _element_children(node)]
        inner = f"<mo>{escape(separator)}</mo>".join(parts)
        open_mo = escape(node.attrs.get("open", "("))
        close_mo = escape(node.attrs.get("close", ")"))
        return f"<mrow><mo>{open_mo}</mo>{inner}<mo>{close_mo}</mo></mrow>"

    is_math = tag in MATH_TAGS
    inner = "".join(_render_html(c, in_math or is_math) for c in node.children)

    if tag == "span" and "underline" in node.attrs.get("style", ""):
        return f"<u>{inner}</u>"
    if tag not in HTML_TAGS and not is_math:
        return inner

    attrs = "".join(
        f' {k}="{escape(v)}"' for k, v in node.attrs.items() if k in KEPT_ATTRS
    )
    if tag in VOID_TAGS:
        return f"<{tag}{attrs}>"
    return f"<{tag}{attrs}>{inner}</{tag}>"


def sanitize_html(html: str) -> str:
    """Keep only allowlisted formatting and MathML tags"""
    return "".join(_render_html(c) for c in parse_html(html).children).strip()


# ---------- Plain text ----------

def _is_simple(text: str) -> bool:
    return bool(re.fullmatch(r"[\w.]+", text))


def _is_parenthesized(text: str) -> bool:
    """True if one pair of parentheses already encloses the whole text"""
    if not (text.startswith("(") and text.endswith(")")):
        return False
    depth = 0
    for i, char in enumerate(text):
        depth += (char == "(") - (char == ")")
        if depth == 0 and i < len(text) - 1:
            return False
    return True


def _wrap(text: str) -> str:
    return text if _is_simple(text) or _is_parenthesized(text) else f"({text})"


def _math_row(children: List[Union[Node, str]]) -> str:
    out = ""
    previous_was_operator = True  # a leading minus is a sign, not subtraction
    for child in children:
        if isinstance(child, str):
            continue
        text = _math_text(child)
        if not text:
            continue
        if child.tag == "mo" and text in BINARY_OPERATORS:
            out += text if previous_was_operator else f" {text} "
            previous_was_operator = True
        else:
            out += text
            previous_was_operator = child.tag == "mo" and text in "(,"
    return out


def _math_text(node: Node) -> str:
    tag = node.tag
    if tag in DROPPED_TAGS:
        return ""
    if tag in MATH_TOKEN_TAGS:
        text = "".join(c for c in node.children if isinstance(c, str))
        # Spaces inside <mtext> separate words; elsewhere they are formatting
        return re.sub(r"\s+", " ", text) if tag == "mtext" else text.strip()

    parts = [_math_text(c) for c in _element_children(node)]
    if tag == "mfrac" and len(parts) == 2:
        return f"{_wrap(parts[0])}/{_wrap(parts[1])}"
    if tag == "msup" and len(parts) == 2:
        return f"{_wrap(parts[0])}^{_wrap(parts[1])}"
    if tag == "msub" and len(parts) == 2:
        return f"{parts[0]}_{_wrap(parts[1])}"
    if tag == "msubsup" and len(parts) == 3:
        return f"{parts[0]}_{_wrap(parts[1])}^{_wrap(parts[2])}"
    if tag == "msqrt":
        return f"√({_math_row(node.children)})"
    if tag == "mroot" and len(parts) == 2:
        return f"{_wrap(parts[0])}^(1/{parts[1]})"
    if tag == "mfenced":
        return node.attrs.get("open", "(") + ", ".join(parts) + node.attrs.get("close", ")")
    if tag == "mtable":
        return "; ".join(p for p in parts if p)
    if tag == "mtr":
        return " ".join(p for p in parts if p)
    return _math_row(node.children)


def _plain(node: Union[Node, str]) -> str:
    if isinstance(node, str):
        return node
    if node.tag in DROPPED_TAGS or _is_screen_reader_only(node):
        return ""
    if node.tag == "math":
        return _math_text(node)
    if node.tag == "br":
        return "\n"
    if node.tag in ("td", "th"):
        return "".join(_plain(c) for c in node.children).strip() + " | "
    inner = "".join(_plain(c) for c in node.children)
    if node.tag in BLOCK_TAGS:
        return f"\n{inner}\n"
    return inner


def html_to_text(html: str) -> str:
    """Readable plain text, with MathML written out linearly (e.g. (12x + 28)/4)"""
    text = "".join(_plain(c) for c in parse_html(html).children)
    text = text.replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip(" |") for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()
