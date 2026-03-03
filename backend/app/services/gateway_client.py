from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Callable, Optional

import websockets
from websockets.exceptions import ConnectionClosed

from app.config import settings

logger = logging.getLogger(__name__)


class GatewayClient:
    """
    Gateway client for FastAPI backend.
    
    NOTE: This client is disabled by default because the gateway requires
    Ed25519 device authentication which only works in browser secure contexts.
    
    Architecture (per V7 patch):
    - Frontend <-> openclaw-studio gateway proxy <-> Gateway (for agent fleet management)
    - Frontend <-> FastAPI backend (for NEW features: analytics, tasks, Notion, self-healing)
    
    The backend provides enhanced features independent of direct gateway access.
    """
    
    def __init__(self):
        self.connected = False
        self.ws = None
        self._listeners: list[Callable] = []
        self._disabled = True  # Disabled by default - gateway requires device auth
        self._disable_reason = "Gateway requires device identity (Ed25519) which is only available in browser secure contexts"

    def on_event(self, fn: Callable):
        self._listeners.append(fn)
        return fn

    async def _emit(self, event: dict):
        for listener in self._listeners:
            try:
                await listener(event)
            except Exception as e:
                logger.error(f"Listener error: {e}")

    async def connect_with_retry(self):
        """
        Attempt to connect to gateway. 
        
        Note: This will likely fail because the gateway requires device identity
        for the 'openclaw-control-ui' client, which requires browser crypto API.
        This is expected behavior - the frontend handles gateway communication
        via openclaw-studio's existing proxy.
        """
        logger.info(
            "Gateway client disabled for backend. "
            "Frontend uses openclaw-studio gateway proxy for agent management. "
            "Backend provides: analytics, tasks, Notion sync, self-healing."
        )
        await self._emit({"type": "gateway.unavailable", "reason": "device_auth_required"})
        return

    async def sessions_list(self, active_minutes: int = 30) -> list[dict]:
        """Get list of active sessions - requires gateway connection."""
        logger.debug("Gateway not connected - sessions list unavailable from backend")
        return []

    async def disconnect(self):
        if self.ws:
            await self.ws.close()
        self.connected = False


# Singleton instance
gateway_client = GatewayClient()
