"""
Approval Model - Enhanced approval tracking with policies.

Based on mission-control's approvals.py but simplified for single-user.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ApprovalPolicy(Base):
    """Approval policy per agent or global."""
    __tablename__ = "approval_policies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), nullable=True, index=True)  # null = global policy
    
    # What requires approval
    tool_pattern = Column(String(200), nullable=True)  # glob pattern for tool names
    command_pattern = Column(String(200), nullable=True)  # glob pattern for commands
    requires_approval = Column(Boolean, default=True)
    
    # Auto-approve settings
    auto_approve_after_count = Column(Integer, default=None)  # Auto-approve after N approvals
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "tool_pattern": self.tool_pattern,
            "command_pattern": self.command_pattern,
            "requires_approval": self.requires_approval,
            "auto_approve_after_count": self.auto_approve_after_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ApprovalDecision(Base):
    """Record of approval decisions made."""
    __tablename__ = "approval_decisions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # What was approved/denied
    request_id = Column(String(100), nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    
    # The action
    action_type = Column(String(50), nullable=False)  # tool, command, exec
    action_name = Column(String(100), nullable=False)
    action_details = Column(JSON, nullable=True)
    
    # Decision
    decision = Column(String(20), nullable=False)  # approved, denied, deferred
    reason = Column(Text, nullable=True)
    
    # Who made the decision (for future multi-user)
    decided_by = Column(String(100), nullable=True)
    
    # Timing
    requested_at = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow)
    response_time_ms = Column(Integer, nullable=True)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "request_id": self.request_id,
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "action_name": self.action_name,
            "action_details": self.action_details,
            "decision": self.decision,
            "reason": self.reason,
            "decided_by": self.decided_by,
            "requested_at": self.requested_at.isoformat() if self.requested_at else None,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "response_time_ms": self.response_time_ms,
        }
