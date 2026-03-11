from __future__ import annotations

import asyncio
from sqlalchemy import select
from app.database import async_session, init_db
from app.models import Agent

# Agent personas with multi-agent configuration (Updated 2026-03-11)
# Local sub-agents + Fleet agents (ClawdBot, Cathy)
PERSONAS = [
    # Local sub-agents
    {"name": "Jarvis",  "role": "Orchestrator", "model": "bailian/glm-5",           "avatar_color": "#6366f1", "status": "idle"},
    {"name": "Wolff",   "role": "Researcher",   "model": "bailian/qwen3.5-plus",   "avatar_color": "#0ea5e9", "status": "idle"},
    {"name": "Dobby",   "role": "Builder",      "model": "bailian/glm-5",           "avatar_color": "#22c55e", "status": "idle"},
    {"name": "Claudy",  "role": "Reviewer",     "model": "bailian/kimi-k2.5",      "avatar_color": "#f59e0b", "status": "idle"},
    # Fleet agents (remote workers)
    {"name": "ClawdBot", "role": "Azure Worker",  "model": "deepseek-v3.1-terminus", "avatar_color": "#ef4444", "status": "active"},
    {"name": "Cathy",    "role": "Android Worker", "model": "gemini-3-flash-preview", "avatar_color": "#a855f7", "status": "active"},
]

async def seed():
    await init_db()
    async with async_session() as db:
        for persona in PERSONAS:
            result = await db.execute(select(Agent).where(Agent.name == persona["name"]))
            existing = result.scalar_one_or_none()
            if not existing:
                agent = Agent(**persona)
                db.add(agent)
                print(f"Seeded agent: {persona['name']}")
            else:
                # Update existing agent with new model
                existing.model = persona["model"]
                print(f"Updated agent: {persona['name']} -> {persona['model']}")
        await db.commit()
    print("Seed complete.")

if __name__ == "__main__":
    asyncio.run(seed())
