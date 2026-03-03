"""Notion → Boards bidirectional sync.

Maps each Notion database to a Board, Status options to columns,
and Notion pages to board cards. Polls every 60 seconds.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import httpx
from sqlalchemy import select, text

from app.config import settings
from app.database import async_session, engine

logger = logging.getLogger(__name__)

# Notion DB → Board mapping
NOTION_BOARDS = [
    {"config_key": "notion_openclaw_db", "board_name": "OpenClaw Tasks", "group": "Notion"},
    {"config_key": "notion_personal_db", "board_name": "Personal Tasks", "group": "Notion"},
    {"config_key": "notion_ideas_db", "board_name": "Ideas Backlog", "group": "Notion"},
]

# Canonical column order
DEFAULT_COLUMN_ORDER = [
    "Inbox", "☐ Not Started", "💭 Brainstorming",
    "▶️ In Progress", "In Progress", "Review", "Blocked",
    "Heartbeat", "✅ Done",
]


def _col_position(name: str) -> int:
    try:
        return DEFAULT_COLUMN_ORDER.index(name)
    except ValueError:
        return len(DEFAULT_COLUMN_ORDER)


async def notion_board_sync():
    """Background task: sync Notion DBs to local boards every 60s."""
    if not settings.notion_api_key:
        logger.info("Notion board sync skipped — no API key")
        return

    logger.info("Notion board sync started")

    # Initial sync immediately
    await _sync_all_boards()

    while True:
        await asyncio.sleep(settings.notion_poll_interval_seconds)
        try:
            await _sync_all_boards()
        except Exception as e:
            logger.error(f"Notion board sync error: {e}")


async def _sync_all_boards():
    headers = {
        "Authorization": f"Bearer {settings.notion_api_key}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        for board_cfg in NOTION_BOARDS:
            db_id = getattr(settings, board_cfg["config_key"], "")
            if not db_id:
                continue
            try:
                await _sync_one_board(client, headers, db_id, board_cfg)
                await asyncio.sleep(0.5)  # Rate limit
            except Exception as e:
                logger.error(f"Board sync error for {board_cfg['board_name']}: {e}")


async def _sync_one_board(client: httpx.AsyncClient, headers: dict, db_id: str, board_cfg: dict):
    board_name = board_cfg["board_name"]
    group = board_cfg["group"]

    # 1. Query all pages from Notion DB
    all_pages = []
    has_more = True
    start_cursor = None
    while has_more:
        body: dict = {}
        if start_cursor:
            body["start_cursor"] = start_cursor
        r = await client.post(
            f"https://api.notion.com/v1/databases/{db_id}/query",
            headers=headers,
            json=body,
        )
        if r.status_code != 200:
            logger.warning(f"Notion query for {board_name} returned {r.status_code}")
            return
        data = r.json()
        all_pages.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")
        if has_more:
            await asyncio.sleep(0.3)

    # 2. Collect unique status values from pages
    statuses: set[str] = set()
    for page in all_pages:
        sel = page.get("properties", {}).get("Status", {}).get("select")
        if sel and sel.get("name"):
            statuses.add(sel["name"])
    if not statuses:
        statuses = {"Inbox"}

    # 3. Ensure board exists in local DB
    async with async_session() as db:
        row = await db.execute(
            text("SELECT id FROM boards WHERE name = :name"),
            {"name": board_name},
        )
        board_row = row.first()
        if board_row:
            board_id = board_row[0]
        else:
            await db.execute(
                text("INSERT INTO boards (name, description, group_name, created_at) VALUES (:name, :desc, :group, :ts)"),
                {"name": board_name, "desc": f"Auto-synced from Notion", "group": group, "ts": datetime.utcnow().isoformat()},
            )
            await db.commit()
            row = await db.execute(text("SELECT id FROM boards WHERE name = :name"), {"name": board_name})
            board_id = row.scalar_one()

        # 4. Ensure columns exist for each status
        existing_cols = await db.execute(
            text("SELECT id, name FROM board_columns WHERE board_id = :bid"),
            {"bid": board_id},
        )
        col_map = {r[1]: r[0] for r in existing_cols.fetchall()}

        for status_name in sorted(statuses, key=_col_position):
            if status_name not in col_map:
                pos = _col_position(status_name)
                await db.execute(
                    text("INSERT INTO board_columns (board_id, name, position, created_at) VALUES (:bid, :name, :pos, :ts)"),
                    {"bid": board_id, "name": status_name, "pos": pos, "ts": datetime.utcnow().isoformat()},
                )
                await db.commit()
                row = await db.execute(
                    text("SELECT id FROM board_columns WHERE board_id = :bid AND name = :name"),
                    {"bid": board_id, "name": status_name},
                )
                col_map[status_name] = row.scalar_one()

        # 5. Sync pages → cards
        existing_cards = await db.execute(
            text("""
                SELECT bc.id, bc.title, bc.description, bc.column_id
                FROM board_cards bc
                JOIN board_columns bcol ON bc.column_id = bcol.id
                WHERE bcol.board_id = :bid
            """),
            {"bid": board_id},
        )
        # Index cards by title for matching (Notion pages don't have a stable local ID link)
        card_rows = existing_cards.fetchall()
        cards_by_title = {r[1]: {"id": r[0], "desc": r[2], "col_id": r[3]} for r in card_rows}

        position = 0
        for page in all_pages:
            props = page.get("properties", {})
            title_parts = props.get("Name", {}).get("title", [])
            title = title_parts[0].get("plain_text", "Untitled") if title_parts else "Untitled"
            title = title[:200]

            sel = props.get("Status", {}).get("select")
            status_name = sel.get("name", "Inbox") if sel else "Inbox"
            col_id = col_map.get(status_name)
            if not col_id:
                col_id = col_map.get("Inbox", list(col_map.values())[0] if col_map else None)
            if not col_id:
                continue

            # Build description from Notion properties
            notes_parts = props.get("Notes", {}).get("rich_text", [])
            notes = notes_parts[0].get("plain_text", "") if notes_parts else ""
            priority_sel = props.get("Priority", {}).get("select")
            priority = priority_sel.get("name", "") if priority_sel else ""
            desc = f"{priority} — {notes}".strip(" — ") if (priority or notes) else ""

            if title in cards_by_title:
                card = cards_by_title[title]
                if card["col_id"] != col_id or card["desc"] != desc:
                    await db.execute(
                        text("UPDATE board_cards SET column_id = :cid, description = :desc WHERE id = :id"),
                        {"cid": col_id, "desc": desc, "id": card["id"]},
                    )
                del cards_by_title[title]  # Mark as seen
            else:
                await db.execute(
                    text("INSERT INTO board_cards (column_id, title, description, position, created_at) VALUES (:cid, :title, :desc, :pos, :ts)"),
                    {"cid": col_id, "title": title, "desc": desc, "pos": position, "ts": datetime.utcnow().isoformat()},
                )
            position += 1

        await db.commit()

    logger.debug(f"Board sync complete: {board_name} — {len(all_pages)} pages")
