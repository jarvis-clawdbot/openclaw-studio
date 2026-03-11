from __future__ import annotations
import time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta

from app.database import get_db
from app.models import CostRecord, Agent, Task

router = APIRouter()

# ── Simple TTL caches ─────────────────────────────────────────
_summary_cache: dict = {"data": None, "ts": 0.0}
_by_agent_cache: dict = {"data": None, "ts": 0.0}
_by_model_cache: dict = {"data": None, "ts": 0.0}
_SUMMARY_TTL = 30.0   # analytics summary: 30s cache
_AGENT_TTL   = 30.0
_MODEL_TTL   = 60.0


@router.get("/summary")
async def get_usage_summary(db: AsyncSession = Depends(get_db)):
    global _summary_cache
    now = time.monotonic()
    if _summary_cache["data"] is not None and (now - _summary_cache["ts"]) < _SUMMARY_TTL:
        return _summary_cache["data"]

    result = await db.execute(
        select(
            func.sum(CostRecord.total_tokens),
            func.sum(CostRecord.cost_usd),
            func.count(CostRecord.id)
        )
    )
    row = result.one()
    data = {
        "total_tokens": row[0] or 0,
        "total_cost": row[1] or 0.0,
        "total_requests": row[2] or 0,
    }
    _summary_cache = {"data": data, "ts": now}
    return data

@router.get("/daily")
async def get_daily_usage(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(CostRecord.recorded_at).label("date"),
            func.sum(CostRecord.total_tokens).label("tokens"),
            func.sum(CostRecord.cost_usd).label("cost"),
            func.count(CostRecord.id).label("requests")
        )
        .where(CostRecord.recorded_at >= since)
        .group_by(func.date(CostRecord.recorded_at))
        .order_by("date")
    )
    return [{"date": row[0], "tokens": row[1] or 0, "cost": row[2] or 0.0, "requests": row[3]} for row in result]

@router.get("/by-agent")
async def get_usage_by_agent(db: AsyncSession = Depends(get_db)):
    global _by_agent_cache
    now = time.monotonic()
    if _by_agent_cache["data"] is not None and (now - _by_agent_cache["ts"]) < _AGENT_TTL:
        return _by_agent_cache["data"]

    # Get usage from cost records
    result = await db.execute(
        select(
            Agent.name,
            func.sum(CostRecord.total_tokens).label("tokens"),
            func.sum(CostRecord.cost_usd).label("cost")
        )
        .join(Agent, CostRecord.agent_id == Agent.id)
        .group_by(Agent.name)
    )
    usage_map = {row[0]: {"tokens": row[1] or 0, "cost": row[2] or 0.0} for row in result}

    # Get ALL agents from DB (include fleet agents even with 0 usage)
    all_agents_result = await db.execute(select(Agent.name))
    data = []
    for (name,) in all_agents_result:
        u = usage_map.get(name, {"tokens": 0, "cost": 0.0})
        data.append({"agent": name, "tokens": u["tokens"], "cost": u["cost"]})

    _by_agent_cache = {"data": data, "ts": now}
    return data

@router.get("/by-model")
async def get_usage_by_model(db: AsyncSession = Depends(get_db)):
    global _by_model_cache
    now = time.monotonic()
    if _by_model_cache["data"] is not None and (now - _by_model_cache["ts"]) < _MODEL_TTL:
        return _by_model_cache["data"]

    result = await db.execute(
        select(
            CostRecord.model,
            func.sum(CostRecord.total_tokens).label("tokens"),
            func.count(CostRecord.id).label("requests")
        )
        .group_by(CostRecord.model)
        .order_by(func.sum(CostRecord.total_tokens).desc())
    )
    data = [{"model": row[0], "tokens": row[1] or 0, "requests": row[2]} for row in result]
    _by_model_cache = {"data": data, "ts": now}
    return data


@router.get("/usage")
async def get_usage(range: str = "24h", db: AsyncSession = Depends(get_db)):
    """Usage stats in the format the frontend BackendAPI expects."""
    from datetime import datetime, timedelta

    hours = {"24h": 24, "7d": 168, "30d": 720}.get(range, 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    # Totals
    total_result = await db.execute(
        select(
            func.sum(CostRecord.input_tokens).label("input"),
            func.sum(CostRecord.output_tokens).label("output"),
            func.count(CostRecord.id).label("requests")
        ).where(CostRecord.recorded_at >= since)
    )
    total_row = total_result.one()
    total_input = total_row[0] or 0
    total_output = total_row[1] or 0
    total_requests = total_row[2] or 0

    # Per-agent
    agent_result = await db.execute(
        select(
            Agent.id,
            Agent.name,
            func.sum(CostRecord.input_tokens).label("input"),
            func.sum(CostRecord.output_tokens).label("output"),
            func.count(CostRecord.id).label("requests")
        )
        .join(Agent, CostRecord.agent_id == Agent.id, isouter=True)
        .where(CostRecord.recorded_at >= since)
        .group_by(Agent.id, Agent.name)
    )

    # Per-model
    model_result = await db.execute(
        select(
            CostRecord.model,
            func.sum(CostRecord.input_tokens).label("input"),
            func.sum(CostRecord.output_tokens).label("output"),
            func.count(CostRecord.id).label("requests")
        )
        .where(CostRecord.recorded_at >= since)
        .group_by(CostRecord.model)
        .order_by(func.sum(CostRecord.total_tokens).desc())
    )

    return {
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_requests": total_requests,
        "agents": [
            {
                "id": str(r[0] or ""),
                "name": r[1] or "Unknown",
                "input_tokens": r[2] or 0,
                "output_tokens": r[3] or 0,
                "requests": r[4] or 0,
            }
            for r in agent_result
        ],
        "models": [
            {
                "model": r[0] or "unknown",
                "input_tokens": r[1] or 0,
                "output_tokens": r[2] or 0,
                "requests": r[3] or 0,
            }
            for r in model_result
        ],
    }
