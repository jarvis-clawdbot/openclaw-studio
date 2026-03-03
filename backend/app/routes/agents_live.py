"""
Live Agent Status - Pull real-time status from openclaw sessions.
"""
from __future__ import annotations
import json
import subprocess
import time
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class AgentStatus(BaseModel):
    id: str
    name: str
    status: str  # "active" | "idle"
    model: str | None
    session_key: str | None
    last_active_seconds: int | None
    total_tokens: int | None


# Map OpenClaw agentId to dashboard agent names
AGENT_MAP = {
    "orchestrator": "Jarvis",
    "researcher": "Wolff",
    "coder": "Dobby",
    "reviewer": "Claudy",
}

REVERSE_MAP = {v.lower(): k for k, v in AGENT_MAP.items()}


def _get_sessions() -> list:
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


@router.get("/live", response_model=List[AgentStatus])
async def get_live_status():
    """Get live agent status from openclaw sessions."""
    sessions = _get_sessions()
    now_ms = time.time() * 1000
    
    # Build status map from sessions
    agent_status = {}
    for s in sessions:
        agent_id = s.get("agentId")
        if not agent_id:
            continue
        
        # Map to dashboard agent name
        agent_name = AGENT_MAP.get(agent_id, agent_id.title())
        agent_key = agent_name.lower()
        
        updated_at = s.get("updatedAt", 0)
        age_ms = now_ms - updated_at if updated_at else 999999999
        age_sec = int(age_ms / 1000)
        
        # Active if updated in last 5 minutes
        is_active = age_sec < 300
        
        if agent_key not in agent_status or age_sec < agent_status[agent_key]["age"]:
            agent_status[agent_key] = {
                "id": agent_key,
                "name": agent_name,
                "status": "active" if is_active else "idle",
                "model": s.get("model"),
                "session_key": s.get("key"),
                "last_active_seconds": age_sec,
                "total_tokens": s.get("totalTokens"),
                "age": age_sec,
            }
    
    # Add known agents that aren't in sessions
    all_agents = ["jarvis", "wolff", "dobby", "claudy"]
    for agent_key in all_agents:
        if agent_key not in agent_status:
            agent_status[agent_key] = {
                "id": agent_key,
                "name": agent_key.title(),
                "status": "idle",
                "model": None,
                "session_key": None,
                "last_active_seconds": None,
                "total_tokens": None,
                "age": 999999,
            }
    
    # Convert to list and remove "age" helper field
    result = []
    for agent in agent_status.values():
        agent.pop("age", None)
        result.append(AgentStatus(**agent))
    
    return result
