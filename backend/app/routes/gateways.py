"""
Gateways API - Multi-gateway management backed by the DB.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter()


class GatewayOut(BaseModel):
    id: int
    name: str
    url: str
    enabled: bool
    is_primary: bool
    status: str
    last_seen: Optional[str] = None


class GatewayCreate(BaseModel):
    name: str
    url: str
    token: Optional[str] = None
    enabled: bool = True
    is_primary: bool = False


@router.get("", response_model=List[GatewayOut])
async def list_gateways(db: AsyncSession = Depends(get_db)):
    """List all registered gateways."""
    result = await db.execute(text("SELECT id, name, url, enabled, is_primary, status, last_seen FROM gateways ORDER BY id"))
    rows = result.fetchall()
    # Seed local gateway if table is empty
    if not rows:
        await db.execute(text(
            "INSERT OR IGNORE INTO gateways (name, url, enabled, is_primary, status, created_at) "
            "VALUES ('Local Gateway', 'ws://localhost:18789', 1, 1, 'connected', :now)"
        ), {"now": datetime.utcnow().isoformat()})
        await db.commit()
        result = await db.execute(text("SELECT id, name, url, enabled, is_primary, status, last_seen FROM gateways ORDER BY id"))
        rows = result.fetchall()
    return [
        GatewayOut(
            id=r[0], name=r[1], url=r[2],
            enabled=bool(r[3]), is_primary=bool(r[4]),
            status=r[5] or "unknown",
            last_seen=r[6],
        )
        for r in rows
    ]


@router.post("", response_model=GatewayOut, status_code=201)
async def add_gateway(data: GatewayCreate, db: AsyncSession = Depends(get_db)):
    """Register a new gateway."""
    result = await db.execute(
        text(
            "INSERT INTO gateways (name, url, token, enabled, is_primary, status, created_at) "
            "VALUES (:name, :url, :token, :enabled, :is_primary, 'disconnected', :now)"
        ),
        {"name": data.name, "url": data.url, "token": data.token,
         "enabled": data.enabled, "is_primary": data.is_primary,
         "now": datetime.utcnow().isoformat()},
    )
    await db.commit()
    gw_id = result.lastrowid
    row = await db.execute(text("SELECT id, name, url, enabled, is_primary, status, last_seen FROM gateways WHERE id = :id"), {"id": gw_id})
    r = row.fetchone()
    return GatewayOut(id=r[0], name=r[1], url=r[2], enabled=bool(r[3]), is_primary=bool(r[4]), status=r[5] or "unknown", last_seen=r[6])


@router.get("/{gateway_id}/status")
async def check_gateway_status(gateway_id: int, db: AsyncSession = Depends(get_db)):
    """Ping a gateway to check connectivity."""
    import asyncio, websockets
    row = await db.execute(text("SELECT url FROM gateways WHERE id = :id"), {"id": gateway_id})
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Gateway not found")
    url = r[0]
    status = "disconnected"
    try:
        async def _try_connect():
            async with websockets.connect(url):
                return "connected"
        status = await asyncio.wait_for(_try_connect(), timeout=3)
    except Exception:
        pass
    await db.execute(
        text("UPDATE gateways SET status = :status, last_seen = :now WHERE id = :id"),
        {"status": status, "now": datetime.utcnow().isoformat(), "id": gateway_id},
    )
    await db.commit()
    return {"id": gateway_id, "status": status}


@router.delete("/{gateway_id}", status_code=204)
async def remove_gateway(gateway_id: int, db: AsyncSession = Depends(get_db)):
    """Remove a gateway."""
    await db.execute(text("DELETE FROM gateways WHERE id = :id"), {"id": gateway_id})
    await db.commit()
