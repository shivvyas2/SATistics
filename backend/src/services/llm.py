"""
One way to call the LLM, whichever provider is configured

- ANTHROPIC_API_KEY: Claude through the Anthropic SDK. Used when set.
- OPENROUTER_API_KEY: any model through OpenRouter's OpenAI-compatible API.

Callers pass a system prompt, a user prompt, and how hard the model should think
(effort), and get the reply text back.
"""

import os
from typing import Optional

from src.config import ANTHROPIC_API_KEY, OPENROUTER_API_KEY

PROVIDER = "anthropic" if ANTHROPIC_API_KEY else "openrouter" if OPENROUTER_API_KEY else None

if PROVIDER == "anthropic":
    LLM_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")
    # A different model checks the answer keys, so the check is independent of the writer
    VERIFIER_MODEL = os.getenv("VERIFIER_MODEL", "claude-sonnet-5-5")
else:
    LLM_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-haiku-4.5")
    VERIFIER_MODEL = os.getenv("VERIFIER_MODEL") or LLM_MODEL

# Room for thinking plus the longest question set; streaming keeps long replies under HTTP timeouts
ANTHROPIC_MAX_TOKENS = 32000
# On a safety decline, the API reruns the request on Anthropic's recommended fallback model
FALLBACK_BETA = "server-side-fallback-2026-07-01"

_client = None


def llm_available() -> bool:
    return PROVIDER is not None


def _get_client():
    global _client
    if _client is None:
        if PROVIDER == "anthropic":
            import anthropic

            _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        else:
            from openai import OpenAI

            _client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=OPENROUTER_API_KEY)
    return _client


def complete(
    system: str,
    prompt: str,
    effort: str = "medium",
    temperature: float = 0.4,
    max_tokens: int = 12000,
    model: Optional[str] = None,
) -> str:
    """
    The model's reply text. effort (low, medium, high) sets how hard Claude thinks; current
    Claude models reject sampling settings, so temperature and max_tokens apply to OpenRouter
    only. Claude gets ANTHROPIC_MAX_TOKENS because thinking counts toward it.
    Raises when no provider is configured, the model declines, or the reply is cut off.
    """
    if PROVIDER is None:
        raise RuntimeError("No LLM configured: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY")
    model = model or LLM_MODEL

    if PROVIDER == "anthropic":
        with _get_client().beta.messages.stream(
            model=model,
            max_tokens=ANTHROPIC_MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_config={"effort": effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            raise RuntimeError(f"{model} declined the request")
        if message.stop_reason == "max_tokens":
            raise RuntimeError(f"{model} reply was cut off at {ANTHROPIC_MAX_TOKENS} tokens")
        return "".join(block.text for block in message.content if block.type == "text")

    response = _get_client().chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content
