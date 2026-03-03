from __future__ import annotations

import asyncio
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)
        logger.info(f"WS client connected. Total: {len(self._clients)}")

    def disconnect(self, ws: WebSocket):
        self._clients.remove(ws)

    async def broadcast(self, data: dict):
        message = json.dumps(data)
        dead = []
        for client in self._clients:
            try:
                await client.send_text(message)
            except Exception:
                dead.append(client)
        for c in dead:
            self._clients.remove(c)

    async def send_state_snapshot(self, ws: WebSocket, agents: list, tasks: list):
        await ws.send_text(json.dumps({
            "type": "state_snapshot",
            "payload": {"agents": agents, "tasks": tasks}
        }))


ws_manager = WebSocketManager()
