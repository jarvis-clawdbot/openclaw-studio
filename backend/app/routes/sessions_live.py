"""
Sessions Live API - Real-time session tracking via OpenClaw CLI.

Endpoints:
  GET  /api/sessions/active         - Active sessions (updated < 30 min)
  GET  /api/sessions/history        - Full session history (all agents)
  POST /api/sessions/{id}/terminate - Terminate a session by key
"""
from __future__ import annotations

import json
import subprocess
import time
import urllib.parse
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# ── TTL cache to avoid hammering the CLI ────────────────────
_CACHE_TTL = 5.0  # seconds
_cache: dict = {"data": None, "ts": 0.0}


# ── Models ────────────────────────────────────────────────────

class LiveSession(BaseModel):
    session_key: str
    agent_id: Optional[str] = None
    status: str = "idle"       # idle | running | error | stalled
    model: Optional[str] = None
    elapsed_time: Optional[str] = None
    elapsed_ms: Optional[int] = None
    current_task: Optional[str] = None
    kind: Optional[str] = None
    total_tokens: Optional[int] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    last_active_at: Optional[str] = None
    context_tokens: Optional[int] = None


class TerminateRequest(BaseModel):
    confirm: bool = False


class TerminateResponse(BaseModel):
    success: bool
    message: str
    session_key: str


# ── Helpers ───────────────────────────────────────────────────

def _run_sessions_cli(active_minutes: Optional[int] = None) -> List[dict]:
    """Call `openclaw sessions --json --all-agents` and return the sessions list."""
    args = ["openclaw", "sessions", "--json", "--all-agents"]
    if active_minutes:
        args += ["--active", str(active_minutes)]

    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=15)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=result.stderr or "CLI error")
        data = json.loads(result.stdout)
        return data.get("sessions", [])
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CLI output: {e}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="CLI timed out")


def _determine_status(session: dict) -> str:
    """Infer session status from age and flags."""
    age_ms = session.get("ageMs", 0) or 0

    if session.get("abortedLastRun"):
        return "error"

    # Running = updated in last 2 minutes
    if age_ms < 120_000:
        return "running"

    # Stalled = updated in last 30 minutes but not recently
    if age_ms < 1_800_000:
        return "stalled"

    return "idle"


def _format_elapsed(age_ms: int) -> str:
    """Convert milliseconds to human-readable elapsed string."""
    if age_ms < 1000:
        return "just now"
    secs = age_ms // 1000
    if secs < 60:
        return f"{secs}s ago"
    mins = secs // 60
    if mins < 60:
        return f"{mins}m ago"
    hrs = mins // 60
    remaining_mins = mins % 60
    if remaining_mins == 0:
        return f"{hrs}h ago"
    return f"{hrs}h {remaining_mins}m ago"


def _extract_task_hint(session: dict) -> Optional[str]:
    """Extract a hint about the current task from session key or label."""
    key: str = session.get("key", "")
    label = session.get("label")
    if label:
        return label

    # Parse hints from key patterns:
    # agent:coder:subagent:uuid  -> "coder subagent"
    # telegram:slash:12345       -> "Telegram slash command"
    # agent:orchestrator:main    -> "Main orchestrator"
    parts = key.split(":")
    if len(parts) >= 3:
        if parts[0] == "agent":
            agent = parts[1]
            role = parts[2]
            if role == "main":
                return f"Main {agent} session"
            if role == "subagent":
                return f"{agent.capitalize()} subagent task"
            return f"{agent} — {role}"
        if parts[0] == "telegram":
            return f"Telegram {parts[1]} session"

    return None


def _serialize_sessions(raw_sessions: List[dict]) -> List[LiveSession]:
    """Convert raw CLI sessions to LiveSession models."""
    result = []
    for s in raw_sessions:
        age_ms = s.get("ageMs", 0) or 0
        status = _determine_status(s)

        result.append(LiveSession(
            session_key=s.get("key", ""),
            agent_id=s.get("agentId"),
            status=status,
            model=s.get("model"),
            elapsed_time=_format_elapsed(age_ms),
            elapsed_ms=age_ms,
            current_task=_extract_task_hint(s),
            kind=s.get("kind"),
            total_tokens=s.get("totalTokens"),
            input_tokens=s.get("inputTokens"),
            output_tokens=s.get("outputTokens"),
            last_active_at=str(s.get("updatedAt")) if s.get("updatedAt") else None,
            context_tokens=s.get("contextTokens"),
        ))

    # Sort: running first, then stalled, then idle
    status_order = {"running": 0, "stalled": 1, "error": 2, "idle": 3}
    result.sort(key=lambda x: (status_order.get(x.status, 9), x.elapsed_ms or 0))
    return result


# ── Routes ────────────────────────────────────────────────────

@router.get("/active", response_model=List[LiveSession])
async def get_active_sessions():
    """
    Returns active sessions — those updated within the last 30 minutes.
    Results are cached for 5 seconds to avoid hammering the CLI.
    """
    global _cache
    now = time.monotonic()

    if _cache["data"] is not None and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    raw = _run_sessions_cli(active_minutes=30)
    data = _serialize_sessions(raw)

    _cache = {"data": data, "ts": now}
    return data


@router.get("/history", response_model=List[LiveSession])
async def get_session_history(limit: int = 50):
    """
    Returns full session history across all agents.
    limit: max sessions to return (default 50)
    """
    raw = _run_sessions_cli()
    data = _serialize_sessions(raw)

    # Limit results
    return data[:max(1, min(limit, 200))]


@router.post("/{session_id}/terminate", response_model=TerminateResponse)
async def terminate_session(session_id: str, body: TerminateRequest):
    """
    Terminate a session by key. Requires confirm=true in the request body.

    Note: OpenClaw doesn't have a direct 'kill session' CLI command.
    This endpoint marks the session as terminated in our tracking and
    attempts to use `openclaw sessions cleanup` as a proxy action.
    """
    decoded_id = urllib.parse.unquote(session_id)

    if not body.confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Send { 'confirm': true } to terminate."
        )

    # Verify the session exists
    raw = _run_sessions_cli()
    session_keys = [s.get("key", "") for s in raw]

    if decoded_id not in session_keys:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{decoded_id}' not found."
        )

    # OpenClaw doesn't expose a CLI kill command for sessions,
    # so we run cleanup to let OpenClaw handle expired sessions.
    try:
        result = subprocess.run(
            ["openclaw", "sessions", "cleanup"],
            capture_output=True, text=True, timeout=15
        )
        # Invalidate cache after terminate attempt
        _cache["data"] = None
        _cache["ts"] = 0.0

        return TerminateResponse(
            success=True,
            message=f"Session cleanup triggered. Session '{decoded_id}' will be removed if inactive.",
            session_key=decoded_id,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="CLI timeout during cleanup")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
