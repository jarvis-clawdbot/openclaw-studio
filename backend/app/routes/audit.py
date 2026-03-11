"""
Audit Log API — Tamper-evident append-only audit trail for all agent actions.

Endpoints:
  GET  /api/audit/logs          – Filtered log listing
  GET  /api/audit/stats         – Summary statistics
  POST /api/audit/log           – Write a single audit entry (internal use)
  POST /api/audit/export        – Export logs as CSV or JSON
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, desc, func, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ── DB setup (sync SQLAlchemy — same pattern as activity.py) ──────────────────
Base = declarative_base()
engine = create_engine(settings.database_url.replace("+aiosqlite", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


class AuditLogORM(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    details = Column(Text, nullable=True)       # JSON string
    risk_level = Column(String(10), default="low")   # low | medium | high
    ip_address = Column(String(64), default="local")
    status = Column(String(20), default="success")   # success | failure | blocked

    __table_args__ = (
        Index("idx_audit_logs_ts_agent", "timestamp", "agent_id"),
        Index("idx_audit_logs_risk", "risk_level"),
    )


# Create table if missing (idempotent)
Base.metadata.create_all(bind=engine)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AuditLogCreate(BaseModel):
    agent_id: str
    action: str
    details: Optional[dict] = None
    risk_level: str = "low"
    ip_address: str = "local"
    status: str = "success"


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    agent_id: str
    action: str
    details: Optional[str]
    risk_level: str
    ip_address: str
    status: str

    class Config:
        from_attributes = True


class AuditStats(BaseModel):
    total: int
    by_agent: dict
    by_action: dict
    by_risk: dict
    by_status: dict
    since_hours: int


# ── Helper ────────────────────────────────────────────────────────────────────

def _row_to_dict(row: AuditLogORM) -> dict:
    return {
        "id": row.id,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "agent_id": row.agent_id,
        "action": row.action,
        "details": row.details,
        "risk_level": row.risk_level,
        "ip_address": row.ip_address,
        "status": row.status,
    }


# ── Public helper for other routes to call ────────────────────────────────────

def log_audit(
    agent_id: str,
    action: str,
    details: dict | None = None,
    risk_level: str = "low",
    ip_address: str = "local",
    status: str = "success",
) -> None:
    """Insert a single audit log entry. Call from any route handler."""
    db = SessionLocal()
    try:
        entry = AuditLogORM(
            agent_id=agent_id,
            action=action,
            details=json.dumps(details) if details else None,
            risk_level=risk_level,
            ip_address=ip_address,
            status=status,
        )
        db.add(entry)
        db.commit()
    except Exception as exc:
        logger.error("[audit] failed to write audit log: %s", exc)
        db.rollback()
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    agent: Optional[str] = Query(None, description="Filter by agent_id"),
    action: Optional[str] = Query(None, description="Filter by action"),
    risk_level: Optional[str] = Query(None, description="low | medium | high"),
    status: Optional[str] = Query(None, description="success | failure | blocked"),
    search: Optional[str] = Query(None, description="Search in details JSON"),
    start_date: Optional[str] = Query(None, description="ISO 8601 start datetime"),
    end_date: Optional[str] = Query(None, description="ISO 8601 end datetime"),
    hours: int = Query(24, ge=1, le=8760),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List audit logs with flexible filters."""
    db = SessionLocal()
    try:
        q = db.query(AuditLogORM)

        # Date range
        if start_date:
            try:
                q = q.filter(AuditLogORM.timestamp >= datetime.fromisoformat(start_date))
            except ValueError:
                raise HTTPException(400, "Invalid start_date format")
        elif hours:
            q = q.filter(AuditLogORM.timestamp >= datetime.utcnow() - timedelta(hours=hours))

        if end_date:
            try:
                q = q.filter(AuditLogORM.timestamp <= datetime.fromisoformat(end_date))
            except ValueError:
                raise HTTPException(400, "Invalid end_date format")

        if agent:
            q = q.filter(AuditLogORM.agent_id == agent)
        if action:
            q = q.filter(AuditLogORM.action == action)
        if risk_level:
            q = q.filter(AuditLogORM.risk_level == risk_level)
        if status:
            q = q.filter(AuditLogORM.status == status)
        if search:
            q = q.filter(AuditLogORM.details.contains(search))

        rows = (
            q.order_by(desc(AuditLogORM.timestamp))
            .offset(offset)
            .limit(limit)
            .all()
        )
        return rows
    finally:
        db.close()


@router.get("/stats")
def get_audit_stats(hours: int = Query(24, ge=1, le=8760)):
    """Return summary statistics for the audit log."""
    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=hours)
        base = db.query(AuditLogORM).filter(AuditLogORM.timestamp >= since)

        total = base.count()

        by_agent = dict(
            db.query(AuditLogORM.agent_id, func.count(AuditLogORM.id))
            .filter(AuditLogORM.timestamp >= since)
            .group_by(AuditLogORM.agent_id)
            .all()
        )
        by_action = dict(
            db.query(AuditLogORM.action, func.count(AuditLogORM.id))
            .filter(AuditLogORM.timestamp >= since)
            .group_by(AuditLogORM.action)
            .all()
        )
        by_risk = dict(
            db.query(AuditLogORM.risk_level, func.count(AuditLogORM.id))
            .filter(AuditLogORM.timestamp >= since)
            .group_by(AuditLogORM.risk_level)
            .all()
        )
        by_status = dict(
            db.query(AuditLogORM.status, func.count(AuditLogORM.id))
            .filter(AuditLogORM.timestamp >= since)
            .group_by(AuditLogORM.status)
            .all()
        )

        return {
            "total": total,
            "by_agent": by_agent,
            "by_action": by_action,
            "by_risk": by_risk,
            "by_status": by_status,
            "since_hours": hours,
        }
    finally:
        db.close()


@router.post("/log", response_model=AuditLogResponse, status_code=201)
def create_audit_log(entry: AuditLogCreate):
    """Write a single audit entry (called internally or by trusted clients)."""
    db = SessionLocal()
    try:
        row = AuditLogORM(
            agent_id=entry.agent_id,
            action=entry.action,
            details=json.dumps(entry.details) if entry.details else None,
            risk_level=entry.risk_level,
            ip_address=entry.ip_address,
            status=entry.status,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    finally:
        db.close()


@router.post("/export")
def export_audit_logs(
    format: str = Query("csv", regex="^(csv|json)$"),
    agent: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    hours: int = Query(168, ge=1, le=8760),
    limit: int = Query(5000, ge=1, le=50000),
):
    """Export audit logs as CSV or JSON download."""
    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=hours)
        q = db.query(AuditLogORM).filter(AuditLogORM.timestamp >= since)
        if agent:
            q = q.filter(AuditLogORM.agent_id == agent)
        if action:
            q = q.filter(AuditLogORM.action == action)
        if risk_level:
            q = q.filter(AuditLogORM.risk_level == risk_level)

        rows = q.order_by(desc(AuditLogORM.timestamp)).limit(limit).all()
        data = [_row_to_dict(r) for r in rows]

        now_str = datetime.utcnow().strftime("%Y%m%d-%H%M%S")

        if format == "json":
            content = json.dumps(data, indent=2).encode()
            return StreamingResponse(
                io.BytesIO(content),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="audit-{now_str}.json"'},
            )

        # CSV
        buf = io.StringIO()
        fieldnames = ["id", "timestamp", "agent_id", "action", "risk_level", "ip_address", "status", "details"]
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
        csv_bytes = buf.getvalue().encode()
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="audit-{now_str}.csv"'},
        )
    finally:
        db.close()
