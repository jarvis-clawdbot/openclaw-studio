from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routes import api_router
from app.services.gateway_client import gateway_client
from app.services.ws_manager import ws_manager
from app.services.self_healing import monitor_loop
from app.services.notion_sync import notion_outbound_worker, notion_inbound_poll
from app.services.session_sync import session_sync_loop
from app.utils.seed import seed

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    # === STARTUP ===
    logger.info("Dashboard Vision starting...")
    await init_db()
    await seed()

    # Wire gateway events → WebSocket broadcast
    @gateway_client.on_event
    async def forward_to_ws(event: dict):
        await ws_manager.broadcast(event)

    _tasks.append(asyncio.create_task(gateway_client.connect_with_retry()))

    if settings.healing_enabled:
        _tasks.append(asyncio.create_task(monitor_loop()))

    # Sync session token data into cost_records every 5 minutes
    _tasks.append(asyncio.create_task(session_sync_loop(300)))

    if settings.notion_sync_enabled:
        _tasks.append(asyncio.create_task(notion_outbound_worker()))
        if settings.notion_sync_mode == "poll":
            _tasks.append(asyncio.create_task(notion_inbound_poll()))

    logger.info("Dashboard Vision ready")
    yield

    # === SHUTDOWN ===
    logger.info("Dashboard Vision shutting down...")
    await gateway_client.disconnect()
    await ws_manager.broadcast({"type": "server.shutdown"})
    for t in _tasks:
        t.cancel()
    logger.info("Dashboard Vision stopped")


app = FastAPI(
    title="Dashboard Vision",
    description="Multi-agent orchestration dashboard for OpenClaw",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
