"""
Logs API - Real-time log streaming from OpenClaw gateway log file.
"""
from __future__ import annotations
import asyncio
import json
import os
import re
import subprocess
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from datetime import datetime

router = APIRouter()

# Real OpenClaw gateway log (plain-text, single rolling file)
LOG_FILE = os.path.expanduser("~/.openclaw/logs/gateway.log")

# Pattern: 2026-03-03T03:45:12.396Z [subsystem] message text
_LOG_RE = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+\[([^\]]+)\]\s+(.*)')

# Map log subsystem tags to level (gateway.log has no level field)
_SUBSYSTEM_LEVEL = {
    "telegram": "info",
    "ws": "debug",
    "agents": "info",
    "memory": "debug",
    "gateway": "info",
    "heartbeat": "debug",
    "cron": "info",
    "hooks": "info",
    "canvas": "debug",
}


def _get_log_file() -> str:
    return LOG_FILE


def _parse_log_line(raw: str) -> Optional[dict]:
    """Parse a plain-text gateway log line into dashboard format."""
    raw = raw.strip()
    if not raw:
        return None
    m = _LOG_RE.match(raw)
    if not m:
        return None
    timestamp, subsystem, message = m.group(1), m.group(2), m.group(3)

    # Determine level from subsystem or keywords in message
    level = _SUBSYSTEM_LEVEL.get(subsystem.split("/")[0], "info")
    if any(w in message.lower() for w in ("error", "fail", "exception", "crash")):
        level = "error"
    elif any(w in message.lower() for w in ("warn", "warning")):
        level = "warn"

    # Map subsystem to agent label
    agent = "system"
    sub_root = subsystem.split("/")[0]
    if sub_root == "agents":
        agent = "agent"
    elif sub_root in ("telegram", "channel"):
        agent = "channel"
    elif sub_root == "memory":
        agent = "memory"
    elif sub_root in ("ws", "gateway"):
        agent = "gateway"

    return {
        "timestamp": timestamp,
        "level": level,
        "message": message[:300],
        "agent": agent,
        "subsystem": subsystem,
    }


@router.get("/stream")
async def stream_logs():
    """Stream real-time logs from openclaw gateway log file via SSE."""
    async def generator():
        log_path = _get_log_file()
        proc = await asyncio.create_subprocess_exec(
            "tail", "-n", "50", "-f", log_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            while True:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=30)
                if not line:
                    break
                entry = _parse_log_line(line.decode("utf-8", errors="ignore"))
                if entry:
                    yield f"data: {json.dumps(entry)}\n\n"
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'timestamp': datetime.utcnow().isoformat(), 'level': 'debug', 'message': 'heartbeat', 'agent': 'system'})}\n\n"
        except Exception:
            pass
        finally:
            proc.kill()

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/recent")
async def get_recent_logs(limit: int = 100):
    """Get recent logs from openclaw gateway log file."""
    try:
        log_path = _get_log_file()
        result = subprocess.run(
            ["tail", "-n", str(limit * 2), log_path],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.splitlines()
        logs = []
        for line in lines:
            entry = _parse_log_line(line)
            if entry:
                logs.append(entry)
        return {"logs": logs[-limit:]}
    except Exception as e:
        return {"logs": [], "error": str(e)}
