from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import RecoveryAction
from app.schemas import RecoveryActionResponse, RecoveryRespond

router = APIRouter()

@router.get("", response_model=list[RecoveryActionResponse])
async def list_recovery_actions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecoveryAction).order_by(RecoveryAction.triggered_at.desc()).limit(50)
    )
    return result.scalars().all()

@router.post("/{recovery_id}/respond")
async def respond_to_recovery(
    recovery_id: int,
    data: RecoveryRespond,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(RecoveryAction).where(RecoveryAction.id == recovery_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Recovery action not found")
    if action.status != "needs_input":
        raise HTTPException(status_code=400, detail=f"Recovery action is {action.status}, not needs_input")
    # A=respawn_fresh, B=adjust, C=manual, D=mark_failed
    action.status = "resolved"
    from datetime import datetime
    action.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok", "action": data.action}
