"""
Gateway Sync Service - Syncs OpenClaw gateway agent status to dashboard database
"""
import logging
from datetime import datetime
from sqlalchemy import select, func
from app.database import async_session
from app.models import Agent

logger = logging.getLogger(__name__)

# Map gateway agent names to database IDs
AGENT_NAME_MAP = {
    # Core agents
    "orchestrator": "Jarvis",
    "researcher": "Wolff",
    "coder": "Dobby",
    "reviewer": "Claudy",
    "jarvis": "Jarvis",
    "wolff": "Wolff",
    "dobby": "Dobby",
    "claudy": "Claudy",
    # Fleet agents
    "clawdbot": "ClawdBot",
    "cathy": "Cathy",
    # Phase 1 specialized agents
    "planner": "Planner",
    "architect": "Architect",
    "security-reviewer": "SecReviewer",
    "secreviewer": "SecReviewer",
    "build-error-resolver": "BuildFixer",
    "buildfixer": "BuildFixer",
    "refactor-cleaner": "Refactor",
    "refactor": "Refactor",
    "doc-updater": "DocUpdater",
    "docupdater": "DocUpdater",
    "database-reviewer": "DBReviewer",
    "dbreviewer": "DBReviewer",
}

async def sync_agent_status(agent_name: str, status: str, session_key: str = None):
    """Update agent status in dashboard database"""
    normalized_name = AGENT_NAME_MAP.get(agent_name.lower(), agent_name.title())
    
    async with async_session() as db:
        # Try exact match first
        result = await db.execute(
            select(Agent).where(Agent.name == normalized_name)
        )
        agent = result.scalar_one_or_none()
        
        # If not found, try case-insensitive match (ilike)
        if not agent:
            result = await db.execute(
                select(Agent).where(func.lower(Agent.name) == func.lower(normalized_name))
            )
            agent = result.scalar_one_or_none()
        
        if agent:
            agent.status = status
            agent.session_key = session_key
            agent.updated_at = datetime.utcnow()
            await db.commit()
            logger.info(f"Synced {agent.name} status to {status}")
            return True
        else:
            logger.warning(f"Agent {normalized_name} not found in database")
            return False

async def mark_agent_active(agent_name: str, session_key: str = None):
    """Mark an agent as active"""
    return await sync_agent_status(agent_name, "active", session_key)

async def mark_agent_idle(agent_name: str):
    """Mark an agent as idle"""
    return await sync_agent_status(agent_name, "idle", None)
