"""
Activity Event Model - Tracks all agent actions for audit/debugging.

Based on mission-control's activity_events.py but simplified for single-user.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ActivityEvent(Base):
    """Audit trail for all agent activities."""
    __tablename__ = "activity_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # What happened
    event_type = Column(String(50), nullable=False, index=True)  # chat, tool_call, approval, etc.
    action = Column(String(100), nullable=False)  # sent_message, called_tool, approved, etc.
    
    # Who/what
    agent_id = Column(String(100), nullable=True, index=True)
    session_key = Column(String(200), nullable=True)
    
    # Details
    details = Column(JSON, nullable=True)
    message_preview = Column(Text, nullable=True)  # First 500 chars of message
    
    # Result
    status = Column(String(20), default="success")  # success, error, pending
    error_message = Column(Text, nullable=True)
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    duration_ms = Column(Integer, nullable=True)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "action": self.action,
            "agent_id": self.agent_id,
            "session_key": self.session_key,
            "details": self.details,
            "message_preview": self.message_preview,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "duration_ms": self.duration_ms,
        }
