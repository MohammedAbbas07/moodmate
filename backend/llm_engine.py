"""
llm_engine.py – Gemini LLM backend for MoodMate mood inference.

Sends structured generateContent requests to the Gemini REST API using only
the Python standard library. No caching, rate limiting, endpoint, or
keyword-engine code is included here.
"""

import json
import logging
import os
import socket
import urllib.error
import urllib.request
from typing import Optional

from mood_prompt import (
    RESPONSE_SCHEMA,
    SYSTEM_INSTRUCTION,
    build_user_prompt,
    validate_and_clamp,
)

# ---------------------------------------------------------------------------
# Module-level logger – never logs the API key, answers, or response text
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model chain
# ---------------------------------------------------------------------------

_BASE_CHAIN: list[str] = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
]

def _build_model_chain() -> list[str]:
    """
    Return the ordered list of model names to try.

    If GEMINI_MODEL is set and non-empty, it is prepended; duplicate entries
    that would follow are left in place so the chain length is predictable.
    """
    env_model = os.environ.get("GEMINI_MODEL", "").strip()
    if env_model:
        return [env_model] + _BASE_CHAIN
    return list(_BASE_CHAIN)


MODEL_CHAIN: list[str] = _build_model_chain()

# ---------------------------------------------------------------------------
# HTTP constants
# ---------------------------------------------------------------------------

_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_REQUEST_TIMEOUT = 20  # seconds

# Status codes that mean "this key/request is broken — stop trying"
_FATAL_STATUS_CODES = {400, 401, 403}

# Status codes that mean "transient — try the next model"
_RETRY_STATUS_CODES = {429, 500, 503, 504}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_request_body(user_prompt: str) -> bytes:
    """Serialise the generateContent request body to UTF-8 JSON bytes."""
    payload = {
        "systemInstruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.3,
        },
    }
    return json.dumps(payload).encode("utf-8")


def _extract_text(resp_data: dict) -> Optional[str]:
    """
    Pull the generated text out of a Gemini response dict.

    Returns None if the expected path is absent or empty.
    """
    try:
        return resp_data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return None


def _block_reason(resp_data: dict) -> Optional[str]:
    """
    Return the promptFeedback blockReason string, or None if there is none.
    """
    reason = resp_data.get("promptFeedback", {}).get("blockReason")
    if not reason or str(reason).upper() in ("", "BLOCK_REASON_UNSPECIFIED"):
        return None
    return str(reason)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def analyze_mood(
    state_answers: list[str],
    preference_answers: list[str],
) -> tuple[Optional[dict], dict]:
    """
    Infer the user's mood using the Gemini LLM.

    Iterates through MODEL_CHAIN, trying each model in order. Returns the
    first valid structured result together with a meta dictionary.

    Parameters
    ----------
    state_answers:
        Answers to questions 1–4, used for mood scoring.
    preference_answers:
        Answers to questions 5–8, used only as content preferences.

    Returns
    -------
    (result, meta)
        result is the validated mood dict, or None on failure.
        meta contains engine, model, attempts, and failure_reason —
        never contains answers, report text, or the API key.
    """
    meta: dict = {
        "engine": "none",
        "model": None,
        "attempts": 0,
        "failure_reason": None,
        "error_detail": None,
    }

    # Read API key at call time
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("GEMINI_API_KEY is missing or empty; aborting LLM call.")
        meta["failure_reason"] = "no_key"
        return None, meta

    user_prompt = build_user_prompt(state_answers, preference_answers)
    body_bytes = _build_request_body(user_prompt)

    chain = _build_model_chain()  # re-evaluate at call time in case env changed

    for model_name in chain:
        url = f"{_API_BASE}/{model_name}:generateContent"
        req = urllib.request.Request(
            url,
            data=body_bytes,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        meta["attempts"] += 1

        # ── Successful HTTP response ─────────────────────────────────────
        try:
            with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as response:
                status = response.status
                resp_data = json.loads(response.read().decode("utf-8"))

            logger.info("model=%s status=%d outcome=ok", model_name, status)

            # Check for a content block
            block = _block_reason(resp_data)
            if block:
                logger.warning(
                    "model=%s status=%d outcome=blocked reason=%s",
                    model_name, status, block,
                )
                continue

            # Extract and validate the generated text
            text = _extract_text(resp_data)
            if not text:
                logger.warning(
                    "model=%s status=%d outcome=empty_response", model_name, status
                )
                continue

            result = validate_and_clamp(text)
            if result is None:
                logger.warning(
                    "model=%s status=%d outcome=invalid_schema", model_name, status
                )
                continue

            # Success
            meta["engine"] = "llm"
            meta["model"] = model_name
            meta["failure_reason"] = None
            return result, meta

        # ── HTTP error responses ─────────────────────────────────────────
        except urllib.error.HTTPError as exc:
            status = exc.code

            # Parse error body for detail — never log request body or answers
            error_detail = "unparseable"
            try:
                err_body = exc.read().decode("utf-8", errors="replace")
                err_json = json.loads(err_body)
                api_status = err_json.get("error", {}).get("status", "")
                api_message = err_json.get("error", {}).get("message", "")
                error_detail = f"{api_status}: {api_message}"[:200]
            except Exception:
                pass

            meta["error_detail"] = error_detail
            logger.warning(
                "model=%s status=%d outcome=http_error api_status_message=%s",
                model_name, status, error_detail,
            )

            if status == 400:
                meta["failure_reason"] = "bad_request"
                return None, meta

            if status in (401, 403):
                meta["failure_reason"] = "auth_error"
                return None, meta

            if status in _RETRY_STATUS_CODES:
                continue

            # Any other HTTP error: treat as transient and try next model
            continue

        # ── Timeout ─────────────────────────────────────────────────────
        except (socket.timeout, TimeoutError):
            logger.warning("model=%s outcome=timeout", model_name)
            continue

        # ── Network / other errors ───────────────────────────────────────
        except urllib.error.URLError as exc:
            logger.warning("model=%s outcome=url_error reason=%s", model_name, type(exc).__name__)
            continue

        except Exception as exc:  # noqa: BLE001
            logger.warning("model=%s outcome=unexpected_error type=%s", model_name, type(exc).__name__)
            continue

    # Every model in the chain failed
    logger.error("All models in chain failed after %d attempt(s).", meta["attempts"])
    meta["failure_reason"] = "all_models_failed"
    return None, meta
