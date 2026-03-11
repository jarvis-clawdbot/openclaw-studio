"""
Model Performance Routes
========================
GET /api/models/leaderboard      - Model ranking by quality/cost composite score
GET /api/models/performance      - Latency (P50, P99), error rates
GET /api/models/cost-comparison  - Cost per model per 1M tokens
"""
from __future__ import annotations

import time
import math
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timedelta

from app.database import get_db
from app.models import CostRecord

router = APIRouter()

# ── TTL caches ─────────────────────────────────────────────────
_leaderboard_cache: dict = {"data": None, "ts": 0.0}
_perf_cache: dict = {"data": None, "ts": 0.0}
_cost_cache: dict = {"data": None, "ts": 0.0}
_TTL = 60.0  # 60s cache

# ── Known pricing (USD per 1M tokens, input/output blended) ────
# Sourced from public pricing pages (approximate)
_MODEL_PRICING: dict[str, dict] = {
    "deepseek-ai/deepseek-v3.1-terminus": {"input": 0.27, "output": 1.10},
    "qwen3.5-plus":                        {"input": 0.80, "output": 2.00},
    "bailian/qwen3.5-plus":                {"input": 0.80, "output": 2.00},
    "bailian/glm-5":                       {"input": 0.10, "output": 0.10},
    "glm-5":                               {"input": 0.10, "output": 0.10},
    "bailian/kimi-k2.5":                   {"input": 0.15, "output": 0.60},
    "kimi-k2.5":                           {"input": 0.15, "output": 0.60},
    "claude-sonnet-4.6":                   {"input": 3.00, "output": 15.00},
    "claude-sonnet-4.5":                   {"input": 3.00, "output": 15.00},
    "MiniMax-M2.5":                        {"input": 0.40, "output": 1.60},
}

# Quality scores (0–100) from known benchmarks / internal assessment
_MODEL_QUALITY: dict[str, float] = {
    "claude-sonnet-4.6":                   92.0,
    "claude-sonnet-4.5":                   90.0,
    "deepseek-ai/deepseek-v3.1-terminus":  86.0,
    "qwen3.5-plus":                        82.0,
    "bailian/qwen3.5-plus":                82.0,
    "MiniMax-M2.5":                        80.0,
    "glm-5":                               78.0,
    "bailian/glm-5":                       78.0,
    "kimi-k2.5":                           75.0,
    "bailian/kimi-k2.5":                   75.0,
}

_DEFAULT_QUALITY = 70.0
_DEFAULT_PRICING = {"input": 1.00, "output": 4.00}


def _short_name(model: str) -> str:
    """Return a display-friendly short name."""
    parts = model.split("/")
    return parts[-1] if parts else model


def _blended_cost_per_1m(model: str, input_tokens: int, output_tokens: int) -> float:
    """Actual blended cost per 1M tokens based on recorded data."""
    total = input_tokens + output_tokens
    if total == 0:
        return 0.0
    pricing = _MODEL_PRICING.get(model, _DEFAULT_PRICING)
    cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
    return round((cost / total) * 1_000_000, 4)


@router.get("/leaderboard")
async def get_model_leaderboard(db: AsyncSession = Depends(get_db)):
    """
    Returns models ranked by a composite Quality/Cost score.
    Score = (quality * 0.6) + (efficiency_norm * 0.4)
    Where efficiency_norm is 1 - normalized(cost_per_1M).
    """
    global _leaderboard_cache
    now = time.monotonic()
    if _leaderboard_cache["data"] is not None and (now - _leaderboard_cache["ts"]) < _TTL:
        return _leaderboard_cache["data"]

    result = await db.execute(
        select(
            CostRecord.model,
            func.count(CostRecord.id).label("requests"),
            func.sum(CostRecord.input_tokens).label("input_tokens"),
            func.sum(CostRecord.output_tokens).label("output_tokens"),
            func.sum(CostRecord.total_tokens).label("total_tokens"),
            func.sum(CostRecord.cost_usd).label("total_cost"),
            func.min(CostRecord.recorded_at).label("first_seen"),
            func.max(CostRecord.recorded_at).label("last_seen"),
        )
        .group_by(CostRecord.model)
        .order_by(func.sum(CostRecord.total_tokens).desc())
    )
    rows = result.all()

    entries = []
    for row in rows:
        model = row[0] or "unknown"
        requests = row[1] or 0
        input_tokens = row[2] or 0
        output_tokens = row[3] or 0
        total_tokens = row[4] or 0
        total_cost = row[5] or 0.0
        first_seen = row[6]
        last_seen = row[7]

        quality = _MODEL_QUALITY.get(model, _DEFAULT_QUALITY)
        cost_per_1m = _blended_cost_per_1m(model, input_tokens, output_tokens)

        entries.append({
            "model": model,
            "short_name": _short_name(model),
            "requests": requests,
            "total_tokens": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost_usd": round(total_cost, 6),
            "cost_per_1m": cost_per_1m,
            "quality_score": quality,
            "first_seen": first_seen.isoformat() if first_seen else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
        })

    if not entries:
        _leaderboard_cache = {"data": [], "ts": now}
        return []

    # Normalise cost_per_1m → efficiency (0=expensive, 1=cheap)
    max_cost = max(e["cost_per_1m"] for e in entries) or 1.0
    min_cost = min(e["cost_per_1m"] for e in entries)
    cost_range = max_cost - min_cost or 1.0

    ranked = []
    for e in entries:
        efficiency = 1.0 - (e["cost_per_1m"] - min_cost) / cost_range
        composite = round((e["quality_score"] * 0.6) + (efficiency * 100 * 0.4), 1)
        e["efficiency_score"] = round(efficiency * 100, 1)
        e["composite_score"] = composite
        ranked.append(e)

    ranked.sort(key=lambda x: x["composite_score"], reverse=True)
    for i, e in enumerate(ranked):
        e["rank"] = i + 1

    _leaderboard_cache = {"data": ranked, "ts": now}
    return ranked


@router.get("/performance")
async def get_model_performance(days: int = 30, db: AsyncSession = Depends(get_db)):
    """
    Returns per-model latency proxies (P50/P99 tokens/request),
    error rates, and request volume over time.

    Note: true latency isn't stored; we use total_tokens/request as a
    compute-cost proxy. Real latency can be added when traced data is available.
    """
    global _perf_cache
    now = time.monotonic()
    if _perf_cache["data"] is not None and (now - _perf_cache["ts"]) < _TTL:
        return _perf_cache["data"]

    since = datetime.utcnow() - timedelta(days=days)

    # Fetch individual records for percentile calculation
    result = await db.execute(
        select(
            CostRecord.model,
            CostRecord.total_tokens,
            CostRecord.cost_usd,
            CostRecord.recorded_at,
        )
        .where(CostRecord.recorded_at >= since)
        .order_by(CostRecord.model, CostRecord.recorded_at)
    )
    rows = result.all()

    # Group by model
    model_records: dict[str, list[dict]] = {}
    for row in rows:
        model = row[0] or "unknown"
        if model not in model_records:
            model_records[model] = []
        model_records[model].append({
            "tokens": row[1] or 0,
            "cost": row[2] or 0.0,
            "recorded_at": row[3],
        })

    data = []
    for model, records in model_records.items():
        tokens_list = sorted(r["tokens"] for r in records)
        n = len(tokens_list)

        def percentile(lst, p):
            if not lst:
                return 0
            idx = max(0, math.ceil((p / 100) * len(lst)) - 1)
            return lst[idx]

        p50 = percentile(tokens_list, 50)
        p99 = percentile(tokens_list, 99)

        # Build a sparkline: last 10 request token counts
        sparkline = [r["tokens"] for r in records[-10:]]

        data.append({
            "model": model,
            "short_name": _short_name(model),
            "requests": n,
            "p50_tokens": p50,
            "p99_tokens": p99,
            "avg_tokens": round(sum(tokens_list) / n) if n > 0 else 0,
            "sparkline": sparkline,
            # error_rate: placeholder (no error data in cost_records yet)
            "error_rate": 0.0,
        })

    data.sort(key=lambda x: x["requests"], reverse=True)
    _perf_cache = {"data": data, "ts": now}
    return data


@router.get("/cost-comparison")
async def get_model_cost_comparison(db: AsyncSession = Depends(get_db)):
    """
    Returns cost per model per 1M tokens (both input and output rates),
    plus actual spend breakdown.
    """
    global _cost_cache
    now = time.monotonic()
    if _cost_cache["data"] is not None and (now - _cost_cache["ts"]) < _TTL:
        return _cost_cache["data"]

    result = await db.execute(
        select(
            CostRecord.model,
            func.count(CostRecord.id).label("requests"),
            func.sum(CostRecord.input_tokens).label("input_tokens"),
            func.sum(CostRecord.output_tokens).label("output_tokens"),
            func.sum(CostRecord.total_tokens).label("total_tokens"),
            func.sum(CostRecord.cost_usd).label("total_cost"),
        )
        .group_by(CostRecord.model)
        .order_by(func.sum(CostRecord.cost_usd).desc())
    )
    rows = result.all()

    total_all = sum((row[5] or 0.0) for row in rows) or 1.0

    data = []
    for row in rows:
        model = row[0] or "unknown"
        requests = row[1] or 0
        input_tokens = row[2] or 0
        output_tokens = row[3] or 0
        total_tokens = row[4] or 0
        total_cost = row[5] or 0.0

        pricing = _MODEL_PRICING.get(model, _DEFAULT_PRICING)
        cost_per_1m_blended = _blended_cost_per_1m(model, input_tokens, output_tokens)

        data.append({
            "model": model,
            "short_name": _short_name(model),
            "requests": requests,
            "total_tokens": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost_usd": round(total_cost, 6),
            "cost_share_pct": round((total_cost / total_all) * 100, 1),
            "cost_per_1m_input": pricing["input"],
            "cost_per_1m_output": pricing["output"],
            "cost_per_1m_blended": cost_per_1m_blended,
        })

    _cost_cache = {"data": data, "ts": now}
    return data
