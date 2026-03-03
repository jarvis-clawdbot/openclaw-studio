"""
Tags System API - Tag agents, tasks, and skills for organization.

Endpoints:
- GET /api/tags - List all tags
- POST /api/tags - Create tag
- GET /api/tags/{tag_id} - Get tag details
- PATCH /api/tags/{tag_id} - Update tag
- DELETE /api/tags/{tag_id} - Delete tag
- POST /api/tags/{tag_id}/apply - Apply tag to entity
- DELETE /api/tags/{tag_id}/remove - Remove tag from entity
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

router = APIRouter()

# Database
Base = declarative_base()
engine = create_engine("sqlite:////Users/jarvis-openclaw/dashboard-vision/backend/dashboard.db")
SessionLocal = sessionmaker(bind=engine)


# Association table for many-to-many
entity_tags = Table(
    "entity_tags",
    Base.metadata,
    Column("tag_id", Integer, ForeignKey("tags.id")),
    Column("entity_type", String),  # agent, task, skill
    Column("entity_id", String),
    Column("created_at", DateTime, default=datetime.utcnow),
)


class TagModel(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, default="#3b82f6")  # hex color
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)


class Tag(BaseModel):
    id: Optional[int] = None
    name: str
    color: str = "#3b82f6"
    description: Optional[str] = None
    created_at: Optional[datetime] = None


class TagCreate(BaseModel):
    name: str
    color: str = "#3b82f6"
    description: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class TagApplication(BaseModel):
    entity_type: str  # agent, task, skill
    entity_id: str


@router.get("", response_model=List[Tag])
async def list_tags():
    """List all tags."""
    db = SessionLocal()
    try:
        tags = db.query(TagModel).all()
        return [Tag(
            id=t.id,
            name=t.name,
            color=t.color,
            description=t.description,
            created_at=t.created_at,
        ) for t in tags]
    finally:
        db.close()


@router.post("", response_model=Tag)
async def create_tag(data: TagCreate):
    """Create a new tag."""
    db = SessionLocal()
    try:
        existing = db.query(TagModel).filter_by(name=data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tag already exists")
        
        tag = TagModel(
            name=data.name,
            color=data.color,
            description=data.description,
        )
        db.add(tag)
        db.commit()
        db.refresh(tag)
        
        return Tag(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            description=tag.description,
            created_at=tag.created_at,
        )
    finally:
        db.close()


@router.get("/{tag_id}", response_model=Tag)
async def get_tag(tag_id: int):
    """Get tag details."""
    db = SessionLocal()
    try:
        tag = db.query(TagModel).filter_by(id=tag_id).first()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        return Tag(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            description=tag.description,
            created_at=tag.created_at,
        )
    finally:
        db.close()


@router.patch("/{tag_id}", response_model=Tag)
async def update_tag(tag_id: int, data: TagUpdate):
    """Update tag."""
    db = SessionLocal()
    try:
        tag = db.query(TagModel).filter_by(id=tag_id).first()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        if data.name is not None:
            tag.name = data.name
        if data.color is not None:
            tag.color = data.color
        if data.description is not None:
            tag.description = data.description
        
        db.commit()
        db.refresh(tag)
        
        return Tag(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            description=tag.description,
            created_at=tag.created_at,
        )
    finally:
        db.close()


@router.delete("/{tag_id}")
async def delete_tag(tag_id: int):
    """Delete tag."""
    db = SessionLocal()
    try:
        tag = db.query(TagModel).filter_by(id=tag_id).first()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Remove all associations
        db.execute(entity_tags.delete().where(entity_tags.c.tag_id == tag_id))
        db.delete(tag)
        db.commit()
        
        return {"status": "deleted", "id": tag_id}
    finally:
        db.close()


@router.post("/{tag_id}/apply")
async def apply_tag(tag_id: int, data: TagApplication):
    """Apply tag to an entity."""
    db = SessionLocal()
    try:
        tag = db.query(TagModel).filter_by(id=tag_id).first()
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Check if already applied
        existing = db.execute(
            entity_tags.select().where(
                entity_tags.c.tag_id == tag_id,
                entity_tags.c.entity_type == data.entity_type,
                entity_tags.c.entity_id == data.entity_id,
            )
        ).first()
        
        if existing:
            return {"status": "already_applied"}
        
        db.execute(entity_tags.insert().values(
            tag_id=tag_id,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
        ))
        db.commit()
        
        return {"status": "applied", "tag_id": tag_id, "entity": data.dict()}
    finally:
        db.close()


@router.delete("/{tag_id}/remove")
async def remove_tag(tag_id: int, data: TagApplication):
    """Remove tag from entity."""
    db = SessionLocal()
    try:
        db.execute(
            entity_tags.delete().where(
                entity_tags.c.tag_id == tag_id,
                entity_tags.c.entity_type == data.entity_type,
                entity_tags.c.entity_id == data.entity_id,
            )
        )
        db.commit()
        return {"status": "removed"}
    finally:
        db.close()


@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_tags(entity_type: str, entity_id: str):
    """Get all tags for an entity."""
    db = SessionLocal()
    try:
        results = db.execute(
            entity_tags.select().where(
                entity_tags.c.entity_type == entity_type,
                entity_tags.c.entity_id == entity_id,
            )
        ).fetchall()
        
        tag_ids = [r[0] for r in results]
        tags = db.query(TagModel).filter(TagModel.id.in_(tag_ids)).all()
        
        return [Tag(
            id=t.id,
            name=t.name,
            color=t.color,
            description=t.description,
            created_at=t.created_at,
        ) for t in tags]
    finally:
        db.close()
