from __future__ import annotations
from fastapi import APIRouter
from sqlalchemy import text
from app.database import async_session

router = APIRouter()

@router.get("")
async def health_check():
    db_status = "ok"
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {e}"

    from app.services.gateway_client import gateway_client
    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "checks": {
            "database": {"status": db_status},
            "gateway": {"connected": gateway_client.connected}
        }
    }
