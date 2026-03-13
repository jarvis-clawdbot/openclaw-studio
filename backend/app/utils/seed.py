from __future__ import annotations

import asyncio
from sqlalchemy import select
from app.database import async_session, init_db
from app.models import Agent

# Agent personas with full multi-agent configuration (Updated 2026-03-12)
# Local sub-agents + Fleet agents (ClawdBot, Cathy) + Phase 1 specialized agents
PERSONAS = [
    # Core agents
    {"name": "Jarvis",      "role": "Orchestrator",          "model": "bailian/glm-5",                        "avatar_color": "#6366f1", "status": "idle"},
    {"name": "Wolff",       "role": "Researcher",             "model": "bailian/qwen3.5-plus",                 "avatar_color": "#0ea5e9", "status": "idle"},
    {"name": "Dobby",       "role": "Builder",                "model": "github-copilot/claude-sonnet-4.6",     "avatar_color": "#22c55e", "status": "idle"},
    {"name": "Claudy",      "role": "Reviewer",               "model": "bailian/kimi-k2.5",                    "avatar_color": "#f59e0b", "status": "idle"},
    # Fleet agents (remote workers)
    {"name": "ClawdBot",    "role": "Azure Worker",           "model": "deepseek-v3.1-terminus",               "avatar_color": "#ef4444", "status": "idle"},
    {"name": "Cathy",       "role": "Android Worker",         "model": "gemini-3-flash-preview",               "avatar_color": "#a855f7", "status": "idle"},
    # Phase 1 specialized agents
    {"name": "Planner",     "role": "Planner",                "model": "bailian/qwen3.5-plus",                 "avatar_color": "#f97316", "status": "idle"},
    {"name": "Architect",   "role": "Architect",              "model": "github-copilot/claude-sonnet-4.6",     "avatar_color": "#8b5cf6", "status": "idle"},
    {"name": "SecReviewer", "role": "Security Reviewer",      "model": "github-copilot/claude-sonnet-4.6",     "avatar_color": "#dc2626", "status": "idle"},
    {"name": "BuildFixer",  "role": "Build Error Resolver",   "model": "bailian/qwen3.5-plus",                 "avatar_color": "#f59e0b", "status": "idle"},
    {"name": "Refactor",    "role": "Refactor Cleaner",       "model": "bailian/qwen3.5-plus",                 "avatar_color": "#10b981", "status": "idle"},
    {"name": "DocUpdater",  "role": "Doc Updater",            "model": "bailian/qwen3.5-plus",                 "avatar_color": "#06b6d4", "status": "idle"},
    {"name": "DBReviewer",  "role": "Database Reviewer",      "model": "bailian/qwen3.5-plus",                 "avatar_color": "#84cc16", "status": "idle"},
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
