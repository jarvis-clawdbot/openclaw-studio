"""
Live Agent Status — reads session JSONL files directly (no subprocess).
Fast: file I/O only, with 5-second TTL cache.
"""
from __future__ import annotations
import asyncio
import glob
import json
import os
import time
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

OPENCLAW_DIR = os.path.expanduser("~/.openclaw/agents")

# ── TTL cache ─────────────────────────────────────────────────
_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 5.0  # seconds


class AgentStatus(BaseModel):
    id: str
    name: str
    status: str
    model: str | None
    session_key: str | None
    last_active_seconds: int | None
    total_tokens: int | None
    role: str = ""
    avatarColor: str = "#6366f1"


AGENT_MAP = {
    "orchestrator": "Jarvis",
    "researcher":   "Wolff",
    "coder":        "Dobby",
    "reviewer":     "Claudy",
}

AGENT_META = {
    "jarvis":  {"role": "Orchestrator",  "avatarColor": "#6366f1"},
    "wolff":   {"role": "Researcher",    "avatarColor": "#0ea5e9"},
    "dobby":   {"role": "Coder",         "avatarColor": "#10b981"},
    "claudy":  {"role": "Reviewer",      "avatarColor": "#f59e0b"},
}


def _read_agent_status(agent_id: str) -> dict:
    """Read the most recent active session JSONL and extract status. Pure file I/O."""
    sessions_dir = os.path.join(OPENCLAW_DIR, agent_id, "sessions")
    if not os.path.isdir(sessions_dir):
        return {}

    files = [f for f in glob.glob(os.path.join(sessions_dir, "*.jsonl"))
             if ".reset." not in f]
    if not files:
        return {}

    latest = max(files, key=os.path.getmtime)
    session_key = os.path.basename(latest).replace(".jsonl", "")

    last_ts: str | None = None
    last_model: str | None = None
    total_tokens: int | None = None

    try:
        with open(latest, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 8192))
            tail = f.read().decode("utf-8", errors="ignore")

        for line in reversed(tail.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if last_ts is None and obj.get("timestamp"):
                last_ts = obj["timestamp"]
            msg = obj.get("message", {}) or {}
            if last_model is None and msg.get("model"):
                last_model = msg["model"]
            usage = msg.get("usage") or obj.get("usage") or {}
            if total_tokens is None and usage.get("totalTokens"):
                total_tokens = usage["totalTokens"]
            if last_ts and last_model:
                break
    except Exception:
        pass

    return {"session_key": session_key, "last_ts": last_ts,
            "model": last_model, "total_tokens": total_tokens}


@router.get("/live", response_model=List[AgentStatus])
async def get_live_status():
    """Get live agent status — cached 5s, reads JSONL files directly."""
    global _cache
    now_mono = time.monotonic()

    if _cache["data"] is not None and (now_mono - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    now_ts = time.time()
    loop = asyncio.get_event_loop()

    # Run all 4 file reads concurrently in the thread pool
    tasks = [
        loop.run_in_executor(None, _read_agent_status, agent_id)
        for agent_id in AGENT_MAP
    ]
    infos = await asyncio.gather(*tasks)

    result = []
    for (agent_id, display_name), info in zip(AGENT_MAP.items(), infos):
        agent_key = display_name.lower()
        meta = AGENT_META.get(agent_key, {})

        last_active_seconds: int | None = None
        status = "idle"

        if info.get("last_ts"):
            try:
                from datetime import datetime
                ts_str = info["last_ts"]
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                age_sec = int(now_ts - dt.timestamp())
                last_active_seconds = age_sec
                status = "active" if age_sec < 300 else "idle"
            except Exception:
                pass

        result.append(AgentStatus(
            id=agent_key,
            name=display_name,
            status=status,
            model=info.get("model"),
            session_key=info.get("session_key"),
            last_active_seconds=last_active_seconds,
            total_tokens=info.get("total_tokens"),
            role=meta.get("role", ""),
            avatarColor=meta.get("avatarColor", "#6366f1"),
        ))

    _cache = {"data": result, "ts": now_mono}
    return result
