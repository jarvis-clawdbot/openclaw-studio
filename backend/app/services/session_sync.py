"""
Session Sync Service - Periodically reads openclaw session token data
and populates the cost_records table so analytics stays current.
"""
from __future__ import annotations

import asyncio
import json
import logging
import subprocess
from datetime import datetime

from sqlalchemy import text

from app.database import async_session as AsyncSessionLocal

logger = logging.getLogger(__name__)

# Map OpenClaw agentId → dashboard agent DB id (will be resolved at runtime)
AGENT_ID_MAP = {
    "orchestrator": "Jarvis",
    "researcher": "Wolff",
    "coder": "Dobby",
    "reviewer": "Claudy",
}


def _fetch_sessions() -> list[dict]:
    """Call openclaw CLI to get all sessions with token data."""
    try:
        result = subprocess.run(
            ["openclaw", "sessions", "--json", "--all-agents"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("sessions", [])
    except Exception as e:
        logger.debug(f"session_sync fetch error: {e}")
    return []


async def _get_agent_id_map(db) -> dict[str, int]:
    """Return {agent_name_lower: db_id} mapping."""
    result = await db.execute(text("SELECT id, name FROM agents"))
    return {row[1].lower(): row[0] for row in result.fetchall()}


async def sync_once():
    """Sync token usage from live sessions into cost_records."""
    sessions = _fetch_sessions()
    if not sessions:
        return

    async with AsyncSessionLocal() as db:
        agent_map = await _get_agent_id_map(db)
        now = datetime.utcnow()
        inserted = 0

        for s in sessions:
            session_key = s.get("key", "")
            agent_id_str = s.get("agentId", "")
            agent_name = AGENT_ID_MAP.get(agent_id_str, agent_id_str)
            db_agent_id = agent_map.get(agent_name.lower())
            if not db_agent_id:
                continue

            input_tokens = s.get("inputTokens") or 0
            output_tokens = s.get("outputTokens") or 0
            total_tokens = s.get("totalTokens") or (input_tokens + output_tokens)
            model = s.get("model") or "unknown"

            if total_tokens == 0:
                continue

            # Check if we already have a record for this session_key today
            existing = await db.execute(
                text(
                    "SELECT id FROM cost_records WHERE agent_id = :aid AND model = :model "
                    "AND date(recorded_at) = date(:today) "
                    "AND total_tokens = :tokens"
                ),
                {"aid": db_agent_id, "model": model, "today": now.isoformat(), "tokens": total_tokens},
            )
            if existing.fetchone():
                continue  # Already recorded

            await db.execute(
                text(
                    "INSERT INTO cost_records (agent_id, model, input_tokens, output_tokens, "
                    "total_tokens, cost_usd, recorded_at) VALUES "
                    "(:aid, :model, :input, :output, :total, :cost, :now)"
                ),
                {
                    "aid": db_agent_id,
                    "model": model,
                    "input": input_tokens,
                    "output": output_tokens,
                    "total": total_tokens,
                    "cost": round(total_tokens * 0.000001, 6),  # rough estimate
                    "now": now.isoformat(),
                },
            )
            inserted += 1

        if inserted:
            await db.commit()
            logger.info(f"session_sync: inserted {inserted} new cost_records")


async def session_sync_loop(interval_seconds: int = 300):
    """Background loop: sync sessions every `interval_seconds` (default 5 min)."""
    logger.info("Session sync loop started")
    while True:
        try:
            await sync_once()
        except Exception as e:
            logger.error(f"session_sync loop error: {e}")
        await asyncio.sleep(interval_seconds)
