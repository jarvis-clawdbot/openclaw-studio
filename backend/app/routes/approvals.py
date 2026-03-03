"""
Approvals API - Enhanced approval tracking with policies.

Endpoints:
- GET /api/approvals/policies - List approval policies
- POST /api/approvals/policies - Create/update policy
- GET /api/approvals/decisions - List approval decisions
- POST /api/approvals/decisions - Record a decision
- GET /api/approvals/stats - Get approval statistics
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, Text, Boolean, desc, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

router = APIRouter()

# Use existing database
Base = declarative_base()
engine = create_engine(settings.database_url.replace("+aiosqlite", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class ApprovalPolicy(Base):
    __tablename__ = "approval_policies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(100), nullable=True, index=True)
    tool_pattern = Column(String(200), nullable=True)
    command_pattern = Column(String(200), nullable=True)
    requires_approval = Column(Boolean, default=True)
    auto_approve_after_count = Column(Integer, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApprovalDecision(Base):
    __tablename__ = "approval_decisions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(100), nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    action_name = Column(String(100), nullable=False)
    action_details = Column(JSON, nullable=True)
    decision = Column(String(20), nullable=False)
    reason = Column(Text, nullable=True)
    decided_by = Column(String(100), nullable=True)
    requested_at = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow)
    response_time_ms = Column(Integer, nullable=True)


# Create tables if not exist
Base.metadata.create_all(bind=engine)


# ============ Schemas ============

class PolicyCreate(BaseModel):
    agent_id: Optional[str] = None
    tool_pattern: Optional[str] = None
    command_pattern: Optional[str] = None
    requires_approval: bool = True
    auto_approve_after_count: Optional[int] = None


class PolicyResponse(BaseModel):
    id: int
    agent_id: Optional[str]
    tool_pattern: Optional[str]
    command_pattern: Optional[str]
    requires_approval: bool
    auto_approve_after_count: Optional[int]
    created_at: datetime
    updated_at: datetime


class DecisionCreate(BaseModel):
    request_id: str
    agent_id: str
    action_type: str
    action_name: str
    action_details: Optional[dict] = None
    decision: str
    reason: Optional[str] = None
    decided_by: Optional[str] = None
    requested_at: Optional[datetime] = None
    response_time_ms: Optional[int] = None


class DecisionResponse(BaseModel):
    id: int
    request_id: str
    agent_id: str
    action_type: str
    action_name: str
    action_details: Optional[dict]
    decision: str
    reason: Optional[str]
    decided_by: Optional[str]
    requested_at: Optional[datetime]
    decided_at: datetime
    response_time_ms: Optional[int]


# ============ Policy Endpoints ============

@router.get("/policies", response_model=List[PolicyResponse])
async def list_policies(agent_id: Optional[str] = None):
    """List approval policies."""
    db = SessionLocal()
    try:
        query = db.query(ApprovalPolicy)
        if agent_id:
            query = query.filter(ApprovalPolicy.agent_id == agent_id)
        return query.all()
    finally:
        db.close()


@router.post("/policies", response_model=PolicyResponse)
async def create_policy(policy: PolicyCreate):
    """Create or update an approval policy."""
    db = SessionLocal()
    try:
        # Check if policy exists for this agent/pattern
        existing = db.query(ApprovalPolicy).filter(
            ApprovalPolicy.agent_id == policy.agent_id,
            ApprovalPolicy.tool_pattern == policy.tool_pattern,
            ApprovalPolicy.command_pattern == policy.command_pattern,
        ).first()
        
        if existing:
            for key, value in policy.model_dump().items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        
        db_policy = ApprovalPolicy(**policy.model_dump())
        db.add(db_policy)
        db.commit()
        db.refresh(db_policy)
        return db_policy
    finally:
        db.close()


@router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: int):
    """Delete an approval policy."""
    db = SessionLocal()
    try:
        policy = db.query(ApprovalPolicy).filter(ApprovalPolicy.id == policy_id).first()
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        db.delete(policy)
        db.commit()
        return {"status": "deleted", "id": policy_id}
    finally:
        db.close()


# ============ Decision Endpoints ============

@router.get("/decisions", response_model=List[DecisionResponse])
async def list_decisions(
    agent_id: Optional[str] = None,
    decision: Optional[str] = None,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(100, ge=1, le=1000),
):
    """List approval decisions."""
    db = SessionLocal()
    try:
        query = db.query(ApprovalDecision).filter(
            ApprovalDecision.decided_at >= datetime.utcnow() - timedelta(hours=hours)
        )
        
        if agent_id:
            query = query.filter(ApprovalDecision.agent_id == agent_id)
        if decision:
            query = query.filter(ApprovalDecision.decision == decision)
        
        return query.order_by(desc(ApprovalDecision.decided_at)).limit(limit).all()
    finally:
        db.close()


@router.post("/decisions", response_model=DecisionResponse)
async def record_decision(decision: DecisionCreate):
    """Record an approval decision."""
    db = SessionLocal()
    try:
        db_decision = ApprovalDecision(**decision.model_dump())
        db.add(db_decision)
        db.commit()
        db.refresh(db_decision)
        return db_decision
    finally:
        db.close()


# ============ Stats ============

@router.get("/stats")
async def get_approval_stats(hours: int = Query(24, ge=1, le=168)):
    """Get approval statistics."""
    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=hours)
        
        total = db.query(ApprovalDecision).filter(ApprovalDecision.decided_at >= since).count()
        approved = db.query(ApprovalDecision).filter(
            ApprovalDecision.decided_at >= since,
            ApprovalDecision.decision == "approved"
        ).count()
        denied = db.query(ApprovalDecision).filter(
            ApprovalDecision.decided_at >= since,
            ApprovalDecision.decision == "denied"
        ).count()
        
        # Average response time
        avg_response = db.query(func.avg(ApprovalDecision.response_time_ms)).filter(
            ApprovalDecision.decided_at >= since,
            ApprovalDecision.response_time_ms.isnot(None)
        ).scalar()
        
        # By action type
        by_type = db.query(
            ApprovalDecision.action_type,
            func.count(ApprovalDecision.id)
        ).filter(ApprovalDecision.decided_at >= since).group_by(ApprovalDecision.action_type).all()
        
        return {
            "hours": hours,
            "total_decisions": total,
            "approved": approved,
            "denied": denied,
            "approval_rate": round(approved / total * 100, 2) if total > 0 else 0,
            "avg_response_time_ms": round(avg_response, 2) if avg_response else None,
            "by_action_type": dict(by_type),
        }
    finally:
        db.close()
