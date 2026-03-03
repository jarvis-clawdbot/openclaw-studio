"""
EventBridge - In-memory buffer for gateway events forwarded from frontend.

Architecture:
    Frontend GatewayClient.onEvent()
        → useEventBridge hook (batch + debounce 100ms)
        → POST /api/gateway-events
        → event_bridge.ingest_batch()
        → subscribers notified (WebSocket broadcast, activity log, etc.)
"""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime
from typing import Any, Callable, Coroutine, Deque, List


class EventBridge:
    def __init__(self, max_events: int = 1000):
        self._max_events = max_events
        self._buffer: Deque[dict] = deque(maxlen=max_events)
        self._subscribers: List[Callable] = []
        self._stats = {"ingested": 0, "batches": 0}

    async def ingest_batch(self, events: List[Any]):
        """Ingest a batch of events (from frontend hook)."""
        self._stats["batches"] += 1
        for ev in events:
            item = ev if isinstance(ev, dict) else ev.dict()
            item.setdefault("received_at", datetime.utcnow().isoformat())
            self._buffer.append(item)
            self._stats["ingested"] += 1
            # Notify subscribers
            for cb in self._subscribers:
                try:
                    result = cb(item)
                    if asyncio.iscoroutine(result):
                        asyncio.create_task(result)
                except Exception:
                    pass

    async def ingest(self, event: dict):
        """Ingest a single event."""
        await self.ingest_batch([event])

    def subscribe(self, callback: Callable):
        """Subscribe to new events. Callback receives each event dict."""
        self._subscribers.append(callback)
        return lambda: self._subscribers.remove(callback)

    def get_recent(self, limit: int = 50) -> List[dict]:
        events = list(self._buffer)
        return events[-limit:][::-1]

    def get_stats(self) -> dict:
        return {
            "ingested": self._stats["ingested"],
            "batches": self._stats["batches"],
            "buffered": len(self._buffer),
            "max_events": self._max_events,
        }

    def count(self) -> int:
        return len(self._buffer)

    def clear(self):
        self._buffer.clear()


# Singleton
event_bridge = EventBridge()


# ---- Auto-log to activity trail (background thread) ----
import threading
import urllib.request
import json

def _log_to_activity(event: dict):
    """Fire-and-forget: persist gateway event to activity table."""
    try:
        data = json.dumps({
            "event_type": event.get("event", "unknown"),
            "action": str(event.get("payload", {}).get("action", event.get("event", "unknown"))),
            "agent_id": event.get("payload", {}).get("agent_id") or event.get("payload", {}).get("agentId"),
            "session_key": event.get("payload", {}).get("session_key") or event.get("payload", {}).get("sessionKey"),
            "details": event.get("payload"),
            "message_preview": str(event.get("payload", ""))[:500],
            "status": "success",
        }).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/activity",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass  # Non-blocking


# Subscribe to all ingested events
event_bridge.subscribe(lambda ev: threading.Thread(target=_log_to_activity, args=(ev,), daemon=True).start())
