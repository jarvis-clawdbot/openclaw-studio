"""
Approval Workflows UI API — Human-in-the-loop approval queue.

Endpoints:
- GET  /api/approvals-ui/pending            - Pending approvals queue
- GET  /api/approvals-ui/history?limit=50   - All past approvals
- POST /api/approvals-ui/{id}/approve       - Approve (optional comment)
- POST /api/approvals-ui/{id}/reject        - Reject (required reason)
- GET  /api/approvals-ui/config             - Get approval thresholds
- POST /api/approvals-ui/config             - Set/update a threshold
- POST /api/approvals-ui/create             - Create an approval record (helper)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional, List, Any

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Approval, ApprovalThreshold

logger = logging.getLogger(__name__)
router = APIRouter()


# ───────────────────────── Pydantic Schemas ──────────────────────────

class ApprovalOut(BaseModel):
    id: int
    created_at: str
    agent_id: str
    action: str
    details: Optional[dict] = None
    risk_level: str
    status: str
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    comment: Optional[str] = None

    model_config = {"from_attributes": True}


class ApproveRequest(BaseModel):
    comment: Optional[str] = None
    decided_by: Optional[str] = "dashboard_user"


class RejectRequest(BaseModel):
    reason: str
    decided_by: Optional[str] = "dashboard_user"


class CreateApprovalRequest(BaseModel):
    agent_id: str
    action: str
    details: Optional[dict] = None
    risk_level: str = "high"


class ThresholdRequest(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None


class ThresholdOut(BaseModel):
    id: int
    key: str
    value: Any
    description: Optional[str] = None
    updated_at: str

    model_config = {"from_attributes": True}


# ───────────────────────── Helpers ───────────────────────────────────

def _to_out(a: Approval) -> ApprovalOut:
    details = None
    if a.details:
        try:
            details = json.loads(a.details)
        except Exception:
            details = {"raw": a.details}
    return ApprovalOut(
        id=a.id,
        created_at=a.created_at.isoformat() if a.created_at else "",
        agent_id=a.agent_id,
        action=a.action,
        details=details,
        risk_level=a.risk_level,
        status=a.status,
        decided_by=a.decided_by,
        decided_at=a.decided_at.isoformat() if a.decided_at else None,
        rejection_reason=a.rejection_reason,
        comment=a.comment,
    )


async def create_approval(
    agent_id: str,
    action: str,
    details: dict,
    risk_level: str,
    db: AsyncSession,
) -> int:
    """Insert a new pending approval and return its ID."""
    approval = Approval(
        agent_id=agent_id,
        action=action,
        details=json.dumps(details) if details else None,
        risk_level=risk_level,
        status="pending",
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)
    logger.info(f"[approvals_ui] Created approval id={approval.id} action={action} agent={agent_id}")
    return approval.id


# ───────────────────────── Endpoints ─────────────────────────────────

@router.get("/pending", response_model=List[ApprovalOut])
async def get_pending(db: AsyncSession = Depends(get_db)):
    """Return all approvals with status='pending', newest first."""
    result = await db.execute(
        select(Approval)
        .where(Approval.status == "pending")
        .order_by(desc(Approval.created_at))
    )
    rows = result.scalars().all()
    return [_to_out(r) for r in rows]


@router.get("/history", response_model=List[ApprovalOut])
async def get_history(
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Return approval history (all statuses), newest first."""
    result = await db.execute(
        select(Approval)
        .order_by(desc(Approval.created_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    return [_to_out(r) for r in rows]


@router.post("/{approval_id}/approve", response_model=ApprovalOut)
async def approve(
    approval_id: int,
    body: ApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending approval."""
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval is already '{approval.status}'")

    approval.status = "approved"
    approval.decided_by = body.decided_by or "dashboard_user"
    approval.decided_at = datetime.utcnow()
    approval.comment = body.comment
    await db.commit()
    await db.refresh(approval)
    logger.info(f"[approvals_ui] Approved id={approval_id} by={body.decided_by}")
    return _to_out(approval)


@router.post("/{approval_id}/reject", response_model=ApprovalOut)
async def reject(
    approval_id: int,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending approval (reason required)."""
    if not body.reason or not body.reason.strip():
        raise HTTPException(status_code=422, detail="Rejection reason is required")

    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval is already '{approval.status}'")

    approval.status = "rejected"
    approval.decided_by = body.decided_by or "dashboard_user"
    approval.decided_at = datetime.utcnow()
    approval.rejection_reason = body.reason.strip()
    await db.commit()
    await db.refresh(approval)
    logger.info(f"[approvals_ui] Rejected id={approval_id} reason={body.reason}")
    return _to_out(approval)


@router.get("/config", response_model=List[ThresholdOut])
async def get_config(db: AsyncSession = Depends(get_db)):
    """Return all approval threshold config entries."""
    result = await db.execute(select(ApprovalThreshold).order_by(ApprovalThreshold.key))
    rows = result.scalars().all()
    return [
        ThresholdOut(
            id=r.id,
            key=r.key,
            value=json.loads(r.value) if r.value else None,
            description=r.description,
            updated_at=r.updated_at.isoformat() if r.updated_at else "",
        )
        for r in rows
    ]


@router.post("/config", response_model=ThresholdOut)
async def set_config(body: ThresholdRequest, db: AsyncSession = Depends(get_db)):
    """Create or update an approval threshold."""
    result = await db.execute(
        select(ApprovalThreshold).where(ApprovalThreshold.key == body.key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = json.dumps(body.value)
        existing.description = body.description or existing.description
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        row = existing
    else:
        row = ApprovalThreshold(
            key=body.key,
            value=json.dumps(body.value),
            description=body.description,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)

    return ThresholdOut(
        id=row.id,
        key=row.key,
        value=json.loads(row.value) if row.value else None,
        description=row.description,
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )


@router.post("/create", response_model=ApprovalOut)
async def create_approval_endpoint(
    body: CreateApprovalRequest, db: AsyncSession = Depends(get_db)
):
    """Create a new approval record. Used by agents or integration hooks."""
    approval_id = await create_approval(
        agent_id=body.agent_id,
        action=body.action,
        details=body.details or {},
        risk_level=body.risk_level,
        db=db,
    )
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one()
    return _to_out(approval)
