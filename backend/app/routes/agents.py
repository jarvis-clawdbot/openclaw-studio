"""
Agents API - Manage agents with real-time status.
"""
from __future__ import annotations

import json
import subprocess
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

# Map OpenClaw agentId to dashboard agent names
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


def _get_live_sessions() -> dict:
    """Get current sessions from openclaw CLI."""
    try:
        result = subprocess.run(
            ["openclaw", "sessions", "--json", "--all-agents"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("sessions", [])
    except Exception:
        pass
    return []


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
    """Get real-time agent status from openclaw sessions."""
    sessions = _get_live_sessions()
    now_ms = time.time() * 1000
    
    # Build status from live sessions
    agent_status = {}
    for s in sessions:
        agent_id = s.get("agentId")
        if not agent_id:
            continue
        
        agent_name = AGENT_MAP.get(agent_id, agent_id.title())
        agent_key = agent_name.lower()
        
        updated_at = s.get("updatedAt", 0)
        age_ms = now_ms - updated_at if updated_at else 999999999
        age_sec = int(age_ms / 1000)
        is_active = age_sec < 1800  # active if updated within last 30 minutes
        
        if agent_key not in agent_status or age_sec < agent_status[agent_key].get("_age", 999999):
            agent_status[agent_key] = {
                "id": agent_key,
                "name": agent_name,
                "status": "active" if is_active else "idle",
                "model": s.get("model"),
                "role": ROLE_MAP.get(agent_key, "Agent"),
                "avatarColor": COLOR_MAP.get(agent_key, "#6b7280"),
                "session_key": s.get("key"),
                "last_active_seconds": age_sec,
                "total_tokens": s.get("totalTokens"),
                "_age": age_sec,
            }
    
    # Add known agents not in sessions (idle)
    for agent_key in ["jarvis", "wolff", "dobby", "claudy"]:
        if agent_key not in agent_status:
            agent_status[agent_key] = {
                "id": agent_key,
                "name": agent_key.title(),
                "status": "idle",
                "model": None,
                "role": ROLE_MAP.get(agent_key, "Agent"),
                "avatarColor": COLOR_MAP.get(agent_key, "#6b7280"),
                "session_key": None,
                "last_active_seconds": None,
                "total_tokens": None,
            }
    
    # Clean up internal fields
    for agent in agent_status.values():
        agent.pop("_age", None)
    
    return list(agent_status.values())


@router.get("")
async def list_agents(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all agents from database (supplement with live status)."""
    # Get live status first
    live_status = {}
    try:
        for agent in await get_live_agents():
            live_status[agent["name"].lower()] = agent
    except Exception:
        pass
    
    # Get from database
    query = select(Agent)
    if status:
        query = query.where(Agent.status == status)
    result = await db.execute(query)
    agents = result.scalars().all()
    
    # Merge with live status
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
