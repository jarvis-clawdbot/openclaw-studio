"""
Organizations API - DB-backed multi-tenant workspace management.
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


class OrgOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    created_at: str


class OrgCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None


def _slugify(name: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("", response_model=List[OrgOut])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """List all organizations."""
    result = await db.execute(text("SELECT id, name, slug, description, created_at FROM organizations ORDER BY id"))
    return [OrgOut(id=r[0], name=r[1], slug=r[2], description=r[3], created_at=str(r[4])) for r in result.fetchall()]


@router.post("", response_model=OrgOut, status_code=201)
async def create_organization(data: OrgCreate, db: AsyncSession = Depends(get_db)):
    """Create a new organization."""
    slug = data.slug or _slugify(data.name)
    now = datetime.utcnow().isoformat()
    result = await db.execute(
        text("INSERT INTO organizations (name, slug, description, created_at) VALUES (:name, :slug, :desc, :now)"),
        {"name": data.name, "slug": slug, "desc": data.description, "now": now},
    )
    await db.commit()
    org_id = result.lastrowid
    row = await db.execute(text("SELECT id, name, slug, description, created_at FROM organizations WHERE id = :id"), {"id": org_id})
    r = row.fetchone()
    return OrgOut(id=r[0], name=r[1], slug=r[2], description=r[3], created_at=str(r[4]))


@router.delete("/{org_id}", status_code=204)
async def delete_organization(org_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an organization."""
    await db.execute(text("DELETE FROM organizations WHERE id = :id"), {"id": org_id})
    await db.commit()
