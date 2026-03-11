from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Agent, RecoveryAction
from app.services.gateway_client import gateway_client
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)


async def monitor_loop():
    logger.info("Self-healing monitor started")
    await asyncio.sleep(10)  # Warm-up delay
    while True:
        try:
            await _check_agents()
        except Exception as e:
            logger.error(f"Self-healing monitor error: {e}")
        await asyncio.sleep(max(settings.healing_poll_interval_seconds, 30))


async def _check_agents():
    sessions = await gateway_client.sessions_list(active_minutes=30)
    session_map = {s.get("key"): s for s in sessions}

    async with async_session() as db:
        result = await db.execute(
            select(Agent).where(Agent.status.in_(["active", "thinking"]))
        )
        agents = result.scalars().all()

        for agent in agents:
            if not agent.session_key:
                continue
            session = session_map.get(agent.session_key)
            if not session:
                # Session gone — mark idle
                agent.status = "idle"
                agent.session_key = None
                await db.commit()
                continue

            last_updated = session.get("lastUpdated")
            if last_updated:
                try:
                    last_dt = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
                    stuck_thresh = timedelta(minutes=settings.healing_stuck_threshold_minutes)
                    if datetime.now(last_dt.tzinfo) - last_dt > stuck_thresh:
                        await _handle_stuck(db, agent)
                except Exception:
                    pass


async def _handle_stuck(db, agent: Agent):
    # Count recent recovery attempts
    result = await db.execute(
        select(RecoveryAction)
        .where(
            RecoveryAction.agent_id == agent.id,
            RecoveryAction.status.in_(["pending", "retrying"])
        )
        .order_by(RecoveryAction.triggered_at.desc())
        .limit(1)
    )
    recent = result.scalar_one_or_none()
    retry_count = (recent.retry_count + 1) if recent else 1

    if retry_count >= settings.healing_max_retries:
        logger.warning(f"Agent {agent.name} failed {retry_count} times — escalating to user")
        action = RecoveryAction(
            agent_id=agent.id,
            session_key=agent.session_key or "",
            action_type="needs_input",
            retry_count=retry_count,
            status="needs_input",
            context_snapshot=json.dumps({"agent": agent.name, "reason": "stuck"})
        )
        db.add(action)
        await db.commit()
        await ws_manager.broadcast({"type": "recovery.needs_input", "payload": {"agent_id": agent.id, "agent_name": agent.name, "retry_count": retry_count}})
        return

    logger.info(f"Nudging stuck agent {agent.name}")
    await gateway_client.sessions_send(
        agent.session_key,
        "Are you stuck? Please summarize your current progress and continue."
    )

    action = RecoveryAction(
        agent_id=agent.id,
        session_key=agent.session_key or "",
        action_type="nudge",
        retry_count=retry_count,
        status="pending"
    )
    db.add(action)
    await db.commit()
    await ws_manager.broadcast({"type": "recovery.started", "payload": {"agent_id": agent.id, "agent_name": agent.name, "action": "nudge"}})
