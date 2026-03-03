"""Dashboard Sync API - Keep dashboard DB in sync with gateway"""
from fastapi import APIRouter
from datetime import datetime
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models import Agent
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Map agent IDs to names
AGENT_NAME_MAP = {
    "orchestrator": "Jarvis",
    "researcher": "Wolff", 
    "coder": "Dobby",
    "reviewer": "Claudy",
    "jarvis": "Jarvis",
    "wolff": "Wolff",
    "dobby": "Dobby",
    "claudy": "Claudy",
}

@router.post("/agent/{agent_id}/spawned")
async def agent_spawned(agent_id: str, session_key: str = None):
    """Called when a subagent is spawned - marks agent as active"""
    name = AGENT_NAME_MAP.get(agent_id.lower(), agent_id.title())
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.name == name))
        agent = result.scalar_one_or_none()
        if agent:
            agent.status = "active"
            agent.session_key = session_key
            agent.updated_at = datetime.utcnow()
            await db.commit()
            logger.info(f"Agent {name} marked as active")
            return {"status": "success", "agent": name, "state": "active"}
    return {"status": "not_found", "agent": name}

@router.post("/agent/{agent_id}/completed")
async def agent_completed(agent_id: str):
    """Called when a subagent completes - marks agent as idle"""
    name = AGENT_NAME_MAP.get(agent_id.lower(), agent_id.title())
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.name == name))
        agent = result.scalar_one_or_none()
        if agent:
            agent.status = "idle"
            agent.session_key = None
            agent.updated_at = datetime.utcnow()
            await db.commit()
            logger.info(f"Agent {name} marked as idle")
            return {"status": "success", "agent": name, "state": "idle"}
    return {"status": "not_found", "agent": name}

@router.post("/sync-all")
async def sync_all_agents():
    """Sync all agents - sets Jarvis active, others idle"""
    async with AsyncSessionLocal() as db:
        # Set all to idle first
        await db.execute(update(Agent).values(status="idle", session_key=None))
        # Set Jarvis active
        result = await db.execute(select(Agent).where(Agent.name == "Jarvis"))
        jarvis = result.scalar_one_or_none()
        if jarvis:
            jarvis.status = "active"
        await db.commit()
        logger.info("All agents synced")
        return {"status": "success"}
