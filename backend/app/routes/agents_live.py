"""
Live Agent Status — reads session JSONL files for local agents,
SSH health checks for fleet agents (ClawdBot/Cathy).
TTL cache: 5s for local, 30s for fleet (SSH is slower).
"""
from __future__ import annotations
import asyncio
import glob
import json
import os
import subprocess
import time
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

OPENCLAW_DIR = os.path.expanduser("~/.openclaw/agents")

_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 5.0
_fleet_cache: dict = {"data": {}, "ts": 0.0}
_FLEET_TTL = 30.0


class AgentStatus(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    name: str
    status: str
    model: Optional[str] = None
    session_key: Optional[str] = None
    last_active_seconds: Optional[int] = None
    total_tokens: Optional[int] = None
    role: str = ""
    avatarColor: str = "#6366f1"
    agent_type: str = "local"   # "local" | "fleet"
    host: Optional[str] = None


# ── Local agents (read JSONL files) ───────────────────────────
LOCAL_AGENT_MAP = {
    "orchestrator": "Jarvis",
    "researcher":   "Wolff",
    "coder":        "Dobby",
    "reviewer":     "Claudy",
}

LOCAL_META = {
    "jarvis":  {"role": "Orchestrator",   "avatarColor": "#6366f1"},
    "wolff":   {"role": "Researcher",     "avatarColor": "#0ea5e9"},
    "dobby":   {"role": "Coder",          "avatarColor": "#10b981"},
    "claudy":  {"role": "Reviewer",       "avatarColor": "#f59e0b"},
}

# ── Fleet agents (SSH health check) ───────────────────────────
FLEET_AGENTS = [
    {
        "id": "clawdbot",
        "name": "ClawdBot",
        "role": "Azure Worker",
        "avatarColor": "#ef4444",
        "host": "Azure VM",
        "ssh_host": "clawdbot@100.111.136.128",
        "ssh_key": os.path.expanduser("~/.ssh/id_azure_clawdbot"),
        "ssh_port": "22",
        "model": "deepseek-v3.1-terminus",
    },
    {
        "id": "cathy",
        "name": "Cathy",
        "role": "Android Worker",
        "avatarColor": "#a855f7",
        "host": "Android",
        "ssh_host": "u0_a233@100.79.94.37",
        "ssh_key": os.path.expanduser("~/.ssh/id_azure_clawdbot"),
        "ssh_port": "8022",
        "model": "gemini-3-flash-preview",
    },
]


def _read_agent_status(agent_id: str) -> dict:
    """Read local agent status from JSONL session files."""
    sessions_dir = os.path.join(OPENCLAW_DIR, agent_id, "sessions")
    if not os.path.isdir(sessions_dir):
        return {}

    files = [f for f in glob.glob(os.path.join(sessions_dir, "*.jsonl"))
             if ".reset." not in f]
    if not files:
        return {}

    latest = max(files, key=os.path.getmtime)
    session_key = os.path.basename(latest).replace(".jsonl", "")

    last_ts: Optional[str] = None
    last_model: Optional[str] = None
    total_tokens: Optional[int] = None

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


def _check_fleet_agent(agent: dict) -> dict:
    """SSH health check for fleet agent. Returns {online, load}."""
    try:
        result = subprocess.run(
            [
                "ssh",
                "-i", agent["ssh_key"],
                "-p", agent["ssh_port"],
                "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=6",
                "-o", "BatchMode=yes",
                agent["ssh_host"],
                "curl -s http://127.0.0.1:18789/ > /dev/null 2>&1 && echo gateway_up || echo gateway_down",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        online = "gateway_up" in result.stdout
        return {"online": online}
    except Exception:
        return {"online": False}


@router.get("/live")
async def get_live_status():
    """Get live status for all agents (local + fleet). Cached."""
    global _cache, _fleet_cache
    now_mono = time.monotonic()

    # Refresh fleet cache if stale
    fleet_stale = (now_mono - _fleet_cache["ts"]) > _FLEET_TTL
    if fleet_stale:
        loop = asyncio.get_event_loop()
        fleet_tasks = [
            loop.run_in_executor(None, _check_fleet_agent, agent)
            for agent in FLEET_AGENTS
        ]
        fleet_results = await asyncio.gather(*fleet_tasks)
        _fleet_cache["data"] = {
            agent["id"]: result
            for agent, result in zip(FLEET_AGENTS, fleet_results)
        }
        _fleet_cache["ts"] = now_mono

    # Return full cached result if still fresh
    if _cache["data"] is not None and (now_mono - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]  # already list of dicts

    now_ts = time.time()
    loop = asyncio.get_event_loop()

    # Local agents — file reads
    local_tasks = [
        loop.run_in_executor(None, _read_agent_status, agent_id)
        for agent_id in LOCAL_AGENT_MAP
    ]
    infos = await asyncio.gather(*local_tasks)

    result: List[AgentStatus] = []

    for (agent_id, display_name), info in zip(LOCAL_AGENT_MAP.items(), infos):
        agent_key = display_name.lower()
        meta = LOCAL_META.get(agent_key, {})

        last_active_seconds: Optional[int] = None
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
            agent_type="local",
            host="Mac",
        ))

    # Fleet agents — SSH check
    fleet_data = _fleet_cache.get("data", {})
    for agent in FLEET_AGENTS:
        fdata = fleet_data.get(agent["id"], {})
        online = fdata.get("online", False)
        result.append(AgentStatus(
            id=agent["id"],
            name=agent["name"],
            status="active" if online else "offline",
            model=agent["model"],
            session_key=None,
            last_active_seconds=None,
            total_tokens=None,
            role=agent["role"],
            avatarColor=agent["avatarColor"],
            agent_type="fleet",
            host=agent["host"],
        ))

    _cache = {"data": result, "ts": now_mono}
    return [r.model_dump() for r in result]
