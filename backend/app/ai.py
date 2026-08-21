"""Gemini proxy. The API key stays server-side and never reaches the browser."""

import asyncio
import logging

import httpx

from .config import settings

log = logging.getLogger("sds.ai")

RETRY_DELAYS = [1, 2, 4, 8, 16]


class AiNotConfigured(RuntimeError):
    pass


def _endpoint() -> str:
    return (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent"
    )


async def _call(payload: dict) -> str | None:
    if not settings.gemini_api_key:
        raise AiNotConfigured("GEMINI_API_KEY is not set")

    async with httpx.AsyncClient(timeout=90.0) as client:
        for attempt, delay in enumerate(RETRY_DELAYS):
            try:
                res = await client.post(
                    _endpoint(),
                    params={"key": settings.gemini_api_key},
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                body = res.json()

                if res.status_code == 200:
                    candidates = body.get("candidates") or []
                    parts = (
                        candidates[0].get("content", {}).get("parts") or []
                        if candidates
                        else []
                    )
                    if parts:
                        return parts[0].get("text")

                message = body.get("error", {}).get("message", "empty response")

                # A bad key, a model this key cannot use, or a malformed request
                # will fail identically on every retry, so surface it now rather
                # than burning 30 seconds of backoff on it.
                if 400 <= res.status_code < 500 and res.status_code != 429:
                    log.error("Gemini %s (%s): %s", res.status_code, settings.gemini_model, message)
                    return None

                raise ValueError(f"{res.status_code}: {message}")
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == len(RETRY_DELAYS) - 1:
                    log.error("Gemini call failed after %d attempts: %s", len(RETRY_DELAYS), exc)
                    return None
                await asyncio.sleep(delay)
    return None


async def generate(prompt: str) -> str | None:
    return await _call({"contents": [{"parts": [{"text": prompt}]}]})


async def chat(messages: list[dict], context: str, lang: str) -> str | None:
    lang_str = "English" if lang == "en" else "繁體中文"
    system_instruction = f"""You are a helpful, expert stock market assistant. Answer the user's questions based strictly on the provided real-time and historical stock data context below.
If the answer cannot be found in the provided data (e.g., they ask about a stock not in the list, or a date outside the range), politely inform the user. Do not make up any numbers.
Please reply in {lang_str}.

[CURRENT ACTIVE STOCKS DATA CONTEXT]
{context}"""

    contents = [
        {
            "role": "model" if m.get("role") == "ai" else "user",
            "parts": [{"text": m.get("text", "")}],
        }
        for m in messages
    ]
    return await _call(
        {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_instruction}]},
        }
    )
