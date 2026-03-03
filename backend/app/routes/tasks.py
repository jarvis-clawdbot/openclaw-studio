from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.models import Task, NotionSyncQueue
from app.schemas import TaskCreate, TaskUpdate, TaskResponse
import json

router = APIRouter()

@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    status: Optional[str] = None,
    agent_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Task)
    if status:
        query = query.where(Task.status == status)
    if agent_id:
        query = query.where(Task.agent_id == agent_id)
    result = await db.execute(query.order_by(Task.created_at.desc()))
    return result.scalars().all()

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(**data.model_dump())
    db.add(task)
    await db.flush()
    # Queue Notion outbound sync
    if True:  # always queue for potential future sync
        sync_item = NotionSyncQueue(
            task_id=task.id,
            action="create",
            source="dashboard",
            payload=json.dumps({"title": task.title, "status": task.status, "priority": task.priority})
        )
        db.add(sync_item)
    await db.commit()
    await db.refresh(task)
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(task, key, value)

    # Queue Notion outbound sync for status/priority changes
    if "status" in changes or "priority" in changes or "title" in changes:
        sync_item = NotionSyncQueue(
            task_id=task.id,
            action="update",
            source="dashboard",
            payload=json.dumps({k: changes[k] for k in changes if k in ("title", "status", "priority", "description")})
        )
        db.add(sync_item)

    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.notion_page_id:
        sync_item = NotionSyncQueue(
            task_id=task.id,
            action="delete",
            source="dashboard",
            payload=json.dumps({"notion_page_id": task.notion_page_id})
        )
        db.add(sync_item)
    await db.delete(task)
    await db.commit()
