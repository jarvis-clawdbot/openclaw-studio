from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import datetime

import httpx
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Task, NotionSyncQueue
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)

STATUS_MAP = {
    "backlog": "☐ Not Started", "queued": "☐ Not Started",
    "in_progress": "▶️ In Progress", "review": "▶️ In Progress",
    "done": "✅ Done", "failed": "☐ Not Started"
}
PRIORITY_MAP = {"P0": "🔴 Urgent", "P1": "🟡 High", "P2": "🟢 Medium", "P3": "🟢 Medium"}


def _db_id(db_id: str) -> str:
    return db_id.replace("-", "")


async def notion_outbound_worker():
    logger.info("Notion outbound worker started")
    while True:
        try:
            await _process_outbound_batch()
        except Exception as e:
            logger.error(f"Notion outbound error: {e}")
        await asyncio.sleep(1)


async def _process_outbound_batch():
    if not settings.notion_api_key:
        await asyncio.sleep(30)
        return

    async with async_session() as db:
        result = await db.execute(
            select(NotionSyncQueue)
            .where(NotionSyncQueue.status == "pending", NotionSyncQueue.retry_count < 3)
            .order_by(NotionSyncQueue.created_at)
            .limit(5)
        )
        items = result.scalars().all()

        for item in items:
            try:
                task_result = await db.execute(select(Task).where(Task.id == item.task_id))
                task = task_result.scalar_one_or_none()
                if not task:
                    item.status = "done"
                    await db.commit()
                    continue

                payload = json.loads(item.payload)
                await asyncio.sleep(0.5)  # Rate limit: ~2 req/sec

                async with httpx.AsyncClient() as client:
                    headers = {
                        "Authorization": f"Bearer {settings.notion_api_key}",
                        "Notion-Version": "2022-06-28",
                        "Content-Type": "application/json"
                    }
                    if item.action == "create" and not task.notion_page_id:
                        db_id = settings.notion_openclaw_db
                        body = {
                            "parent": {"database_id": db_id},
                            "properties": {
                                "Name": {"title": [{"text": {"content": task.title}}]},
                                "Status": {"select": {"name": STATUS_MAP.get(task.status, "☐ Not Started")}},
                                "Priority": {"select": {"name": PRIORITY_MAP.get(task.priority, "🟢 Medium")}}
                            }
                        }
                        r = await client.post("https://api.notion.com/v1/pages", headers=headers, json=body)
                        if r.status_code == 200:
                            page_id = r.json()["id"]
                            task.notion_page_id = page_id
                            task.notion_sync_status = "synced"
                            item.status = "done"
                        else:
                            raise Exception(f"Notion API {r.status_code}: {r.text[:200]}")

                    elif item.action == "update" and task.notion_page_id:
                        props = {}
                        if "title" in payload:
                            props["Name"] = {"title": [{"text": {"content": payload["title"]}}]}
                        if "status" in payload:
                            props["Status"] = {"select": {"name": STATUS_MAP.get(payload["status"], "☐ Not Started")}}
                        if "priority" in payload:
                            props["Priority"] = {"select": {"name": PRIORITY_MAP.get(payload["priority"], "🟢 Medium")}}
                        if props:
                            r = await client.patch(
                                f"https://api.notion.com/v1/pages/{task.notion_page_id}",
                                headers=headers,
                                json={"properties": props}
                            )
                            if r.status_code == 200:
                                item.status = "done"
                            else:
                                raise Exception(f"Notion API {r.status_code}: {r.text[:200]}")

                    elif item.action == "delete" and task.notion_page_id:
                        r = await client.patch(
                            f"https://api.notion.com/v1/pages/{task.notion_page_id}",
                            headers=headers,
                            json={"archived": True}
                        )
                        item.status = "done"

                    item.processed_at = datetime.utcnow()
                    await db.commit()

            except Exception as e:
                item.retry_count += 1
                item.error_message = str(e)
                if item.retry_count >= 3:
                    item.status = "error"
                await db.commit()
                logger.error(f"Notion sync error for item {item.id}: {e}")


REVERSE_STATUS_MAP = {v: k for k, v in STATUS_MAP.items()}
REVERSE_PRIORITY_MAP = {v: k for k, v in PRIORITY_MAP.items()}

DB_NAME_MAP = {
    "notion_openclaw_db": "OpenClaw Tasks",
    "notion_personal_db": "Personal Tasks",
    "notion_ideas_db": "Ideas Backlog",
}


async def notion_inbound_poll():
    """Poll all Notion databases for external changes every 60 seconds.
    Creates new local tasks for pages not yet synced."""
    if not settings.notion_api_key:
        return
    logger.info("Notion inbound poll started")

    while True:
        await asyncio.sleep(settings.notion_poll_interval_seconds)
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {settings.notion_api_key}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json"
                }
                db_ids = [
                    settings.notion_openclaw_db,
                    settings.notion_personal_db,
                    settings.notion_ideas_db,
                ]
                for db_id in db_ids:
                    if not db_id:
                        continue
                    r = await client.post(
                        f"https://api.notion.com/v1/databases/{db_id}/query",
                        headers=headers,
                        json={}
                    )
                    if r.status_code != 200:
                        logger.warning(f"Notion query failed for {db_id}: {r.status_code}")
                        continue
                    pages = r.json().get("results", [])
                    await _sync_notion_pages(pages, db_id)
                    await asyncio.sleep(0.5)  # Rate limit between DBs
        except Exception as e:
            logger.error(f"Notion inbound poll error: {e}")


async def _sync_notion_pages(pages: list, db_id: str):
    """Sync Notion pages to local tasks — create new or update existing."""
    async with async_session() as db:
        for page in pages:
            page_id = page["id"]
            props = page.get("properties", {})

            title_parts = props.get("Name", {}).get("title", [])
            title = title_parts[0].get("plain_text", "Untitled") if title_parts else "Untitled"

            status_sel = props.get("Status", {}).get("select", {})
            status_name = status_sel.get("name", "") if status_sel else ""
            local_status = REVERSE_STATUS_MAP.get(status_name, "backlog")

            priority_sel = props.get("Priority", {}).get("select", {})
            priority_name = priority_sel.get("name", "") if priority_sel else ""
            local_priority = REVERSE_PRIORITY_MAP.get(priority_name, "P2")

            incoming_hash = hashlib.md5(json.dumps(props, sort_keys=True).encode()).hexdigest()

            result = await db.execute(select(Task).where(Task.notion_page_id == page_id))
            task = result.scalar_one_or_none()

            if task:
                if incoming_hash == task.last_synced_hash:
                    continue
                task.title = title
                task.status = local_status
                task.priority = local_priority
                task.last_synced_hash = incoming_hash
                task.notion_sync_status = "synced"
                await db.commit()
                await ws_manager.broadcast({
                    "type": "task.updated",
                    "payload": {"task_id": task.id, "source": "notion"}
                })
            else:
                # Determine source tag from DB ID
                if db_id == settings.notion_openclaw_db:
                    source = "openclaw"
                elif db_id == settings.notion_personal_db:
                    source = "personal"
                else:
                    source = "ideas"

                new_task = Task(
                    title=title,
                    description=f"Synced from Notion ({source})",
                    status=local_status,
                    priority=local_priority,
                    source=source,
                    is_idea=(source == "ideas"),
                    notion_page_id=page_id,
                    notion_sync_status="synced",
                    last_synced_hash=incoming_hash,
                )
                db.add(new_task)
                await db.commit()
                await db.refresh(new_task)
                logger.info(f"Created task from Notion: {title} (page {page_id[:12]})")
                await ws_manager.broadcast({
                    "type": "task.created",
                    "payload": {"task_id": new_task.id, "source": "notion"}
                })
