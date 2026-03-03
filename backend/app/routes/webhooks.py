"""
Webhooks API - DB-backed webhook management.
"""
from __future__ import annotations
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter()


class WebhookOut(BaseModel):
    id: int
    name: str
    url: str
    events: List[str]
    enabled: bool


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str] = []
    enabled: bool = True
    secret: Optional[str] = None


@router.get("", response_model=List[WebhookOut])
async def list_webhooks(db: AsyncSession = Depends(get_db)):
    """List all webhooks."""
    result = await db.execute(text("SELECT id, name, url, events, enabled FROM webhooks ORDER BY id"))
    return [
        WebhookOut(id=r[0], name=r[1], url=r[2], events=json.loads(r[3] or "[]"), enabled=bool(r[4]))
        for r in result.fetchall()
    ]


@router.post("", response_model=WebhookOut, status_code=201)
async def create_webhook(data: WebhookCreate, db: AsyncSession = Depends(get_db)):
    """Create a new webhook."""
    result = await db.execute(
        text("INSERT INTO webhooks (name, url, events, enabled, secret, created_at) VALUES (:name, :url, :events, :enabled, :secret, :now)"),
        {"name": data.name, "url": data.url, "events": json.dumps(data.events),
         "enabled": data.enabled, "secret": data.secret, "now": datetime.utcnow().isoformat()},
    )
    await db.commit()
    wh_id = result.lastrowid
    row = await db.execute(text("SELECT id, name, url, events, enabled FROM webhooks WHERE id = :id"), {"id": wh_id})
    r = row.fetchone()
    return WebhookOut(id=r[0], name=r[1], url=r[2], events=json.loads(r[3] or "[]"), enabled=bool(r[4]))


@router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: int, db: AsyncSession = Depends(get_db)):
    """Send a test payload to the webhook URL."""
    import httpx
    row = await db.execute(text("SELECT url FROM webhooks WHERE id = :id"), {"id": webhook_id})
    r = row.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Webhook not found")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(r[0], json={"type": "test", "timestamp": datetime.utcnow().isoformat()})
            return {"status": "success", "http_status": resp.status_code}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(webhook_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a webhook."""
    await db.execute(text("DELETE FROM webhooks WHERE id = :id"), {"id": webhook_id})
    await db.commit()
