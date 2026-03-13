#!/usr/bin/env python3
"""Seed activity events for Phase 2 testing"""

import sqlite3
from datetime import datetime

DB_PATH = "/Users/jarvis-openclaw/dashboard-vision/backend/dashboard.db"

# Activity events to seed
events = [
    {
        "event_type": "research",
        "action": "overnight_research_complete",
        "agent_id": "ClawdBot",
        "details": '{"gist_url": "https://gist.github.com/clawdbot/daily-digest", "token_count": 2084}',
        "message_preview": "Synthesized daily research digest (2084 bytes)",
        "status": "success",
        "created_at": "2026-03-12 15:09:00"
    },
    {
        "event_type": "pipeline",
        "action": "pipeline_complete",
        "agent_id": "Jarvis",
        "details": '{"phase": 1, "agents_added": 7}',
        "message_preview": "Phase 1 fleet setup: synced MEMORY.md to ClawdBot+Cathy, added 7 agents to dashboard",
        "status": "success",
        "created_at": "2026-03-12 13:30:00"
    },
    {
        "event_type": "sync",
        "action": "agent_sync",
        "agent_id": "ClawdBot",
        "details": '{"files": ["MEMORY.md", "AGENTS.md", "USER.md", "SOUL.md"]}',
        "message_preview": "Fleet memory sync received: MEMORY.md, AGENTS.md, USER.md, SOUL.md",
        "status": "success",
        "created_at": "2026-03-12 13:15:00"
    },
    {
        "event_type": "research",
        "action": "research_complete",
        "agent_id": "Jarvis",
        "details": '{"topic": "fleet best practices", "word_count": 1987}',
        "message_preview": "Wolff research: fleet best practices (1987 words)",
        "status": "success",
        "created_at": "2026-03-12 14:37:00"
    },
    {
        "event_type": "cron",
        "action": "cron_added",
        "agent_id": "Jarvis",
        "details": '{"cron": "clawdbot-overnight-research", "schedule": "2 AM daily"}',
        "message_preview": "Added clawdbot-overnight-research cron (2 AM daily)",
        "status": "success",
        "created_at": "2026-03-12 14:00:00"
    }
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

for event in events:
    cursor.execute("""
        INSERT INTO activity_events 
        (event_type, action, agent_id, details, message_preview, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        event["event_type"],
        event["action"],
        event["agent_id"],
        event["details"],
        event["message_preview"],
        event["status"],
        event["created_at"]
    ))

conn.commit()
conn.close()

print(f"✅ Seeded {len(events)} activity events")
