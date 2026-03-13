"""Sync API - Trigger dashboard database sync with gateway"""
from fastapi import APIRouter, HTTPException
from app.services.gateway_sync import sync_agent_status, mark_agent_active, mark_agent_idle, AGENT_NAME_MAP
from app.services.ws_manager import ws_manager
from app.database import async_session
from app.models.activity import ActivityEvent
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

async def log_activity_event(agent_name: str, action: str, details: dict = None):
    """Log an activity event when agent status changes"""
    normalized_name = AGENT_NAME_MAP.get(agent_name.lower(), agent_name.title())
    async with async_session() as db:
        event = ActivityEvent(
            event_type="agent_status",
            action=action,
            agent_id=normalized_name,
            details=details or {},
            status="success",
            created_at=datetime.utcnow()
        )
        db.add(event)
        await db.commit()

@router.post("/agent/{agent_name}/active")
async def set_agent_active(agent_name: str, session_key: str = None):
    """Mark an agent as active"""
    success = await mark_agent_active(agent_name, session_key)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
    # Log activity event
    await log_activity_event(agent_name, "agent_active", {"session_key": session_key})
    # Broadcast to WebSocket clients
    await ws_manager.broadcast({
        "type": "agent.status",
        "agent": {"name": agent_name, "status": "active"}
    })
    return {"status": "success", "agent": agent_name, "state": "active"}

@router.post("/agent/{agent_name}/idle")
async def set_agent_idle(agent_name: str):
    """Mark an agent as idle"""
    success = await mark_agent_idle(agent_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
    # Log activity event
    await log_activity_event(agent_name, "agent_idle", {})
    # Broadcast to WebSocket clients
    await ws_manager.broadcast({
        "type": "agent.status",
        "agent": {"name": agent_name, "status": "idle"}
    })
    return {"status": "success", "agent": agent_name, "state": "idle"}

@router.post("/agent/{agent_name}/status")
async def set_agent_status(agent_name: str, status: str, session_key: str = None):
    """Set agent status directly"""
    success = await sync_agent_status(agent_name, status, session_key)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
    # Log activity event
    await log_activity_event(agent_name, f"agent_{status}", {"session_key": session_key})
    # Broadcast to WebSocket clients
    await ws_manager.broadcast({
        "type": "agent.status",
        "agent": {"name": agent_name, "status": status}
    })
    return {"status": "success", "agent": agent_name, "state": status}
