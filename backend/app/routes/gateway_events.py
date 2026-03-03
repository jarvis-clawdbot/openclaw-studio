"""
Gateway Events API - Receives events from frontend for backend processing.

POST /api/gateway-events  - Receive single or batch of gateway events
GET  /api/gateway-events/stats  - Event statistics
GET  /api/gateway-events/recent - Recent events
DELETE /api/gateway-events/buffer - Clear buffer
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Optional, List
from datetime import datetime

from app.services.event_bridge import event_bridge

router = APIRouter()


class GatewayEventItem(BaseModel):
    event: str
    payload: Optional[dict[str, Any]] = None
    seq: Optional[int] = None
    type: Optional[str] = None  # "event"


class GatewayEventBatch(BaseModel):
    """Batch of events from frontend hook."""
    events: List[GatewayEventItem]


@router.post("")
async def ingest_events(body: dict):
    """
    Receive gateway events from frontend.
    Accepts both single event and batched { events: [...] } format.
    """
    # Batch format: { events: [...] }
    if "events" in body:
        events = body["events"]
    # Single format: { event: "...", payload: {...} }
    elif "event" in body:
        events = [body]
    else:
        return {"status": "ok", "ingested": 0}

    await event_bridge.ingest_batch(events)
    return {"status": "ok", "ingested": len(events)}


@router.get("/stats")
async def get_stats():
    return event_bridge.get_stats()


@router.get("/recent")
async def get_recent(limit: int = 50):
    return {"events": event_bridge.get_recent(limit), "count": event_bridge.count()}


@router.delete("/buffer")
async def clear_buffer():
    event_bridge.clear()
    return {"status": "cleared"}
