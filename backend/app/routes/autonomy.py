"""
Autonomy Status API - Dashboard widget data for Phase 4 Full Autonomy Loop.

Endpoints:
- GET /api/autonomy/status - Get autonomy status widget data
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, Text, desc, func, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

router = APIRouter()

# Use existing database
Base = declarative_base()
engine = create_engine(settings.database_url.replace("+aiosqlite", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(50), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    agent_id = Column(String(100), nullable=True, index=True)
    session_key = Column(String(200), nullable=True)
    details = Column(JSON, nullable=True)
    message_preview = Column(Text, nullable=True)
    status = Column(String(20), default="success")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    duration_ms = Column(Integer, nullable=True)


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False)
    priority = Column(String(2), nullable=False)
    source = Column(String(20), nullable=False)
    is_idea = Column(Integer, nullable=False)
    agent_id = Column(Integer, nullable=True)
    notion_page_id = Column(String(50), nullable=True)
    notion_sync_status = Column(String(20), nullable=False)
    last_synced_hash = Column(String(32), nullable=True)
    cost_usd = Column(Float, nullable=False)
    tokens_used = Column(Integer, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)


@router.get("/status")
async def get_autonomy_status():
    """
    Get autonomy status widget data for dashboard.
    
    Returns:
    - last_research_run: ISO timestamp of last overnight research completion
    - next_scheduled_run: Hardcoded "02:00 AM daily"
    - circuit_breaker_state: Object with failure count from last 5 ClawdBot events
    - pending_proposals: Count of tasks with status='pending' AND source='pipeline'
    """
    db = SessionLocal()
    try:
        # 1. Last overnight research run
        last_research = db.query(ActivityEvent).filter(
            ActivityEvent.action == "overnight_research_complete"
        ).order_by(desc(ActivityEvent.created_at)).first()
        
        last_research_run = last_research.created_at.isoformat() if last_research else None
        
        # 2. Next scheduled run (hardcoded)
        next_scheduled_run = "02:00 AM daily"
        
        # 3. Circuit breaker state for ClawdBot
        # Get last 5 activity events for ClawdBot
        clawdbot_events = db.query(ActivityEvent).filter(
            ActivityEvent.agent_id == "ClawdBot"
        ).order_by(desc(ActivityEvent.created_at)).limit(5).all()
        
        failure_count = sum(1 for evt in clawdbot_events if evt.status in ["error", "failed", "warning", "blocked"])
        success_count = len(clawdbot_events) - failure_count
        
        # Determine state: OPEN if 3+ failures in last 5, CLOSED otherwise
        circuit_breaker_state = "OPEN" if failure_count >= 3 else "CLOSED"
        
        circuit_breaker = {
            "state": circuit_breaker_state,
            "last_5_events": {
                "total": len(clawdbot_events),
                "successes": success_count,
                "failures": failure_count
            }
        }
        
        # 4. Pending proposals (tasks with status='pending' AND source='pipeline')
        pending_count = db.query(Task).filter(
            Task.status == "pending",
            Task.source == "pipeline"
        ).count()
        
        return {
            "last_research_run": last_research_run,
            "next_scheduled_run": next_scheduled_run,
            "circuit_breaker": circuit_breaker,
            "pending_proposals": pending_count,
            "last_updated": datetime.utcnow().isoformat()
        }
    finally:
        db.close()
