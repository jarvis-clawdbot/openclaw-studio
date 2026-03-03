"""
Agents API - Manage agents with real-time status.
"""
from __future__ import annotations

import asyncio
import glob
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Agent

router = APIRouter()

OPENCLAW_DIR = os.path.expanduser("~/.openclaw/agents")

# ── TTL cache ─────────────────────────────────────────────────
_live_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 5.0  # seconds

AGENT_MAP = {
    "orchestrator": "Jarvis",
    "researcher": "Wolff",
    "coder": "Dobby",
    "reviewer": "Claudy",
}

ROLE_MAP = {
    "jarvis": "Orchestrator",
    "wolff": "Researcher",
    "dobby": "Builder",
    "claudy": "Reviewer",
}

COLOR_MAP = {
    "jarvis": "#8b5cf6",
    "wolff": "#3b82f6",
    "dobby": "#10b981",
    "claudy": "#f59e0b",
}


def _read_agent_session(agent_id: str) -> dict:
    """Read the most recent active session JSONL for an agent. Pure file I/O — no subprocess."""
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


async def _build_live_status() -> list:
    """Build live agent status from JSONL files (async, cached 5s)."""
    global _live_cache
    now_mono = time.monotonic()

    if _live_cache["data"] is not None and (now_mono - _live_cache["ts"]) < _CACHE_TTL:
        return _live_cache["data"]

    now_ts = time.time()
    loop = asyncio.get_event_loop()

    tasks = [loop.run_in_executor(None, _read_agent_session, agent_id)
             for agent_id in AGENT_MAP]
    infos = await asyncio.gather(*tasks)

    result = []
    for (agent_id, display_name), info in zip(AGENT_MAP.items(), infos):
        agent_key = display_name.lower()

        last_active_seconds: int | None = None
        status = "idle"

        if info.get("last_ts"):
            try:
                dt = datetime.fromisoformat(info["last_ts"].replace("Z", "+00:00"))
                age_sec = int(now_ts - dt.timestamp())
                last_active_seconds = age_sec
                status = "active" if age_sec < 300 else "idle"
            except Exception:
                pass

        result.append({
            "id": agent_key,
            "name": display_name,
            "status": status,
            "model": info.get("model"),
            "role": ROLE_MAP.get(agent_key, "Agent"),
            "avatarColor": COLOR_MAP.get(agent_key, "#6b7280"),
            "session_key": info.get("session_key"),
            "last_active_seconds": last_active_seconds,
            "total_tokens": info.get("total_tokens"),
        })

    _live_cache = {"data": result, "ts": now_mono}
    return result


class AgentResponse(BaseModel):
    id: int
    name: str
    role: Optional[str] = None
    model: Optional[str] = None
    avatar_color: Optional[str] = None
    status: str = "idle"
    session_key: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AgentCreate(BaseModel):
    name: str
    role: Optional[str] = None
    model: Optional[str] = None
    avatar_color: Optional[str] = "#6b7280"


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None
    session_key: Optional[str] = None


@router.get("/live")
async def get_live_agents():
    """Get real-time agent status from session JSONL files (cached 5s)."""
    return await _build_live_status()


@router.get("")
async def list_agents(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all agents from database (supplement with live status)."""
    live_status = {}
    try:
        for agent in await _build_live_status():
            live_status[agent["name"].lower()] = agent
    except Exception:
        pass

    query = select(Agent)
    if status:
        query = query.where(Agent.status == status)
    result = await db.execute(query)
    agents = result.scalars().all()

    output = []
    for a in agents:
        agent_key = a.name.lower() if a.name else ""
        live = live_status.get(agent_key, {})
        output.append({
            "id": a.id,
            "name": a.name,
            "role": a.role or live.get("role"),
            "model": a.model or live.get("model"),
            "avatar_color": a.avatar_color or live.get("avatarColor"),
            "status": live.get("status", a.status or "idle"),
            "session_key": live.get("session_key"),
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        })

    return output


@router.get("/{agent_id}")
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Get single agent by ID."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(data: AgentCreate, db: AsyncSession = Depends(get_db)):
    """Create new agent."""
    agent = Agent(
        name=data.name,
        role=data.role,
        model=data.model,
        avatar_color=data.avatar_color,
        status="idle",
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: int, data: AgentUpdate, db: AsyncSession = Depends(get_db)):
    """Update agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(agent, key, value)
    
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: int, db: AsyncSession = Depends(get_db)):
    """Delete agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
