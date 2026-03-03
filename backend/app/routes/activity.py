"""
Activity API - Audit timeline for agent actions.

Endpoints:
- GET /api/activity - List activity events (paginated)
- GET /api/activity/:id - Get single event
- POST /api/activity - Create activity event (called by event bridge)
- GET /api/activity/stats - Get activity statistics
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, Text, desc
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


# Create table if not exists
Base.metadata.create_all(bind=engine)


class ActivityCreate(BaseModel):
    event_type: str
    action: str
    agent_id: Optional[str] = None
    session_key: Optional[str] = None
    details: Optional[dict] = None
    message_preview: Optional[str] = None
    status: str = "success"
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None


class ActivityResponse(BaseModel):
    id: int
    event_type: str
    action: str
    agent_id: Optional[str]
    session_key: Optional[str]
    details: Optional[dict]
    message_preview: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime
    duration_ms: Optional[int]


@router.get("", response_model=List[ActivityResponse])
async def list_activity(
    agent_id: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List activity events with filters."""
    db = SessionLocal()
    try:
        query = db.query(ActivityEvent).filter(
            ActivityEvent.created_at >= datetime.utcnow() - timedelta(hours=hours)
        )
        
        if agent_id:
            query = query.filter(ActivityEvent.agent_id == agent_id)
        if event_type:
            query = query.filter(ActivityEvent.event_type == event_type)
        if status:
            query = query.filter(ActivityEvent.status == status)
        
        events = query.order_by(desc(ActivityEvent.created_at)).offset(offset).limit(limit).all()
        return events
    finally:
        db.close()


@router.get("/stats")
async def get_activity_stats(hours: int = Query(24, ge=1, le=168)):
    """Get activity statistics."""
    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=hours)
        
        total = db.query(ActivityEvent).filter(ActivityEvent.created_at >= since).count()
        errors = db.query(ActivityEvent).filter(
            ActivityEvent.created_at >= since,
            ActivityEvent.status == "error"
        ).count()
        
        # Count by type
        from sqlalchemy import func
        by_type = db.query(
            ActivityEvent.event_type,
            func.count(ActivityEvent.id)
        ).filter(ActivityEvent.created_at >= since).group_by(ActivityEvent.event_type).all()
        
        # Count by agent
        by_agent = db.query(
            ActivityEvent.agent_id,
            func.count(ActivityEvent.id)
        ).filter(
            ActivityEvent.created_at >= since,
            ActivityEvent.agent_id.isnot(None)
        ).group_by(ActivityEvent.agent_id).all()
        
        return {
            "hours": hours,
            "total_events": total,
            "errors": errors,
            "error_rate": round(errors / total * 100, 2) if total > 0 else 0,
            "by_type": dict(by_type),
            "by_agent": dict(by_agent),
        }
    finally:
        db.close()


@router.post("", response_model=ActivityResponse)
async def create_activity(event: ActivityCreate):
    """Create an activity event (called by event bridge)."""
    db = SessionLocal()
    try:
        db_event = ActivityEvent(**event.model_dump())
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        return db_event
    finally:
        db.close()


@router.get("/{event_id}", response_model=ActivityResponse)
async def get_activity(event_id: int):
    """Get a single activity event."""
    db = SessionLocal()
    try:
        event = db.query(ActivityEvent).filter(ActivityEvent.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    finally:
        db.close()


@router.delete("/cleanup")
async def cleanup_old_events(days: int = Query(30, ge=1, le=365)):
    """Delete events older than specified days."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        deleted = db.query(ActivityEvent).filter(ActivityEvent.created_at < cutoff).delete()
        db.commit()
        return {"deleted": deleted, "cutoff": cutoff.isoformat()}
    finally:
        db.close()
