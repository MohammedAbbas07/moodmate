"""
mood_routes.py – FastAPI router for the mood-analysis endpoint.

POST /api/mood/analyze calls the Gemini LLM engine and falls back gracefully
so the frontend keyword engine can take over on any LLM failure.

In-memory protections (no extra dependencies):
  - Per-user rate limit  : 5 requests / 60 s
  - Daily budget counter : MOOD_DAILY_LLM_LIMIT (default 200), resets at UTC midnight
  - Answer cache         : SHA-256 keyed, 10-minute TTL
"""

import hashlib
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

from auth import verify_token
from llm_engine import analyze_mood
from mood_prompt import DISCLAIMER

# ---------------------------------------------------------------------------
# Logger – never logs answers or report text
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Auth dependency – mirrors get_current_user_id in main.py exactly
# ---------------------------------------------------------------------------

_security = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> int:
    """Extract and validate the user ID from a bearer header.

    Missing, malformed, expired, and invalid tokens all become HTTP 401 errors.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return verify_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

_MAX_ANSWER_LEN = 500
_ANSWERS_COUNT = 4


def _clean_answer(v: str) -> str:
    """Trim and truncate one answer string."""
    return v.strip()[:_MAX_ANSWER_LEN]


class MoodAnalyzeRequest(BaseModel):
    """Validated request body for the mood-analysis endpoint."""

    state_answers: list[Annotated[str, Field(min_length=0, max_length=_MAX_ANSWER_LEN)]]
    preference_answers: list[Annotated[str, Field(min_length=0, max_length=_MAX_ANSWER_LEN)]]

    @field_validator("state_answers", "preference_answers", mode="before")
    @classmethod
    def _clean_and_check_length(cls, v: list) -> list:
        """Trim each answer and enforce the fixed list length."""
        if not isinstance(v, list):
            raise ValueError("Must be a list of strings.")
        cleaned = [_clean_answer(str(item)) for item in v]
        if len(cleaned) != _ANSWERS_COUNT:
            raise ValueError(f"Exactly {_ANSWERS_COUNT} answers are required.")
        return cleaned


# ---------------------------------------------------------------------------
# In-memory state (per-process; no external dependency)
# ---------------------------------------------------------------------------

_lock = threading.Lock()

# Per-user rate limit: {user_id: [timestamp, ...]}
_user_request_times: dict[int, list[float]] = {}
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 60.0  # seconds

# Daily budget
_daily_count: int = 0
_daily_reset_date: str = ""  # ISO date string "YYYY-MM-DD"

# Answer cache: {cache_key: (result_dict, expiry_timestamp)}
_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 600.0  # 10 minutes


def _today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _daily_limit() -> int:
    raw = os.environ.get("MOOD_DAILY_LLM_LIMIT", "").strip()
    try:
        return max(1, int(raw))
    except (ValueError, TypeError):
        return 200


def _cache_key(state_answers: list[str], preference_answers: list[str]) -> str:
    """SHA-256 hash of normalised answers; never stores the answers themselves."""
    combined = "\x00".join(state_answers + preference_answers)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def _check_rate_limit(user_id: int, now: float) -> bool:
    """Return True if the user is within their rate limit."""
    timestamps = _user_request_times.get(user_id, [])
    # Keep only timestamps inside the window
    timestamps = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
    if len(timestamps) >= _RATE_LIMIT_MAX:
        return False
    timestamps.append(now)
    _user_request_times[user_id] = timestamps
    return True


def _check_and_increment_daily(today: str) -> bool:
    """Return True if the daily budget has not been exhausted; increment the counter."""
    global _daily_count, _daily_reset_date
    if _daily_reset_date != today:
        _daily_count = 0
        _daily_reset_date = today
    if _daily_count >= _daily_limit():
        return False
    _daily_count += 1
    return True


def _cache_get(key: str, now: float) -> dict | None:
    """Return a cached result if still valid, otherwise None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    result, expiry = entry
    if now > expiry:
        del _cache[key]
        return None
    return result


def _cache_set(key: str, result: dict, now: float) -> None:
    """Store a result in the cache."""
    _cache[key] = (result, now + _CACHE_TTL)


# ---------------------------------------------------------------------------
# Keyword fallback response
# ---------------------------------------------------------------------------

_KEYWORD_FALLBACK: dict = {"engine": "keyword", "result": None}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/api/mood/analyze")
def analyze_mood_endpoint(
    payload: MoodAnalyzeRequest,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    """Infer the user's mood via the LLM engine and return a structured result.

    Falls back to a keyword-engine signal (result: null) on any LLM failure
    so the caller can run its existing keyword engine instead. Never raises
    an HTTP error due to an LLM-side problem.
    """
    now = time.monotonic()
    today = _today_utc()
    key = _cache_key(payload.state_answers, payload.preference_answers)

    with _lock:
        # 1. Cache hit
        cached = _cache_get(key, now)
        if cached is not None:
            logger.info("user_id=%d engine=cache outcome=hit", user_id)
            return {"engine": "llm", "result": cached, "disclaimer": DISCLAIMER}

        # 2. Per-user rate limit
        if not _check_rate_limit(user_id, now):
            logger.info("user_id=%d engine=none outcome=rate_limited", user_id)
            return _KEYWORD_FALLBACK

        # 3. Daily budget
        if not _check_and_increment_daily(today):
            logger.info("user_id=%d engine=none outcome=daily_budget_exhausted", user_id)
            return _KEYWORD_FALLBACK

    # 4. Call LLM (outside the lock so other requests are not blocked during I/O)
    result, meta = analyze_mood(payload.state_answers, payload.preference_answers)

    logger.info(
        "user_id=%d engine=%s model=%s attempts=%d failure_reason=%s",
        user_id,
        meta.get("engine"),
        meta.get("model"),
        meta.get("attempts", 0),
        meta.get("failure_reason"),
    )

    if result is None:
        return _KEYWORD_FALLBACK

    # 5. Cache the successful result
    with _lock:
        _cache_set(key, result, now)

    return {"engine": "llm", "result": result, "disclaimer": DISCLAIMER}
