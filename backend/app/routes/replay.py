"""Replay API - Fetch real session data from OpenClaw gateway"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
import os
import json
import glob
import datetime

router = APIRouter()

AGENTS_DIR = "/Users/jarvis-openclaw/.openclaw/agents"
MAIN_SESSIONS_DIR = "/Users/jarvis-openclaw/.openclaw/sessions"


def parse_ts(ts_str: str) -> int:
    """Parse ISO timestamp to milliseconds."""
    try:
        return int(datetime.datetime.fromisoformat(
            ts_str.replace("Z", "+00:00")
        ).timestamp() * 1000)
    except Exception:
        return 0


def count_events(filepath: str) -> tuple:
    """Count message events in a JSONL session file. Returns (count, created_at, updated_at, last_user_msg)."""
    count = 0
    created_at = None
    updated_at = None
    last_user_msg = None

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
                ts = obj.get("timestamp")
                if ts and created_at is None:
                    created_at = ts
                if ts:
                    updated_at = ts

                t = obj.get("type", "")

                # OpenClaw JSONL format: type="message" with message.role = user/assistant
                if t == "message":
                    role = obj.get("message", {}).get("role", "")
                    if role in ("user", "assistant"):
                        count += 1
                        if role == "user" and last_user_msg is None:
                            content = obj.get("message", {}).get("content", "")
                            if isinstance(content, list):
                                for part in content:
                                    if isinstance(part, dict) and part.get("type") == "text":
                                        last_user_msg = part.get("text", "")[:120]
                                        break
                            elif isinstance(content, str):
                                last_user_msg = content[:120]
                # Legacy/alternate formats
                elif t in ("user", "assistant", "tool_call", "tool_use", "tool_result", "tool_response"):
                    count += 1
                    if t == "user" and last_user_msg is None:
                        content = obj.get("content", "")
                        if isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and part.get("type") == "text":
                                    last_user_msg = part.get("text", "")[:120]
                                    break
                        elif isinstance(content, str):
                            last_user_msg = content[:120]
            except Exception:
                pass

    return count, created_at, updated_at, last_user_msg


def scan_sessions() -> List[dict]:
    sessions = []

    # Scan per-agent sessions
    pattern = os.path.join(AGENTS_DIR, "*", "sessions", "*.jsonl")
    files = glob.glob(pattern)

    # Also scan main sessions if they exist
    if os.path.isdir(MAIN_SESSIONS_DIR):
        files += glob.glob(os.path.join(MAIN_SESSIONS_DIR, "*.jsonl"))

    for filepath in sorted(files, key=os.path.getmtime, reverse=True)[:50]:
        try:
            agent_id = "orchestrator"
            agent_name = "Jarvis"
            parts = filepath.replace(AGENTS_DIR + "/", "").split("/")
            if len(parts) >= 1 and parts[0] != filepath:
                agent_id = parts[0]
                agent_name = parts[0].capitalize()

            session_id = os.path.basename(filepath).replace(".jsonl", "")

            message_count, created_at, updated_at, last_user_msg = count_events(filepath)

            sessions.append({
                "id": session_id,
                "agentId": agent_id,
                "agentName": agent_name,
                "status": "completed",
                "messageCount": message_count,
                "lastMessage": last_user_msg,
                "createdAt": created_at or "2026-01-01T00:00:00Z",
                "updatedAt": updated_at or "2026-01-01T00:00:00Z",
                "startedAt": parse_ts(created_at) if created_at else 0,
                "endedAt": parse_ts(updated_at) if updated_at else None,
                "events": [],
            })
        except Exception as e:
            print(f"Error reading {filepath}: {e}")

    return sessions


@router.get("/sessions")
async def list_sessions():
    """List all sessions from the gateway agent directories."""
    return scan_sessions()


@router.get("/sessions/{session_id}/events")
async def get_session_events(session_id: str):
    """Get events for a specific session."""
    pattern = os.path.join(AGENTS_DIR, "*", "sessions", f"{session_id}.jsonl")
    matches = glob.glob(pattern)
    if not matches and os.path.isdir(MAIN_SESSIONS_DIR):
        alt = os.path.join(MAIN_SESSIONS_DIR, f"{session_id}.jsonl")
        if os.path.exists(alt):
            matches = [alt]

    if not matches:
        raise HTTPException(status_code=404, detail="Session not found")

    filepath = matches[0]
    events = []

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for i, raw in enumerate(f):
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
                t = obj.get("type", "unknown")
                ts_str = obj.get("timestamp", "2026-01-01T00:00:00Z")
                ts_ms = parse_ts(ts_str) or (i * 1000)

                content = ""
                frontend_type = t

                # OpenClaw primary format: type="message", message.role=user|assistant
                if t == "message":
                    role = obj.get("message", {}).get("role", "unknown")
                    msg_content = obj.get("message", {}).get("content", "")
                    if isinstance(msg_content, list):
                        for part in msg_content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                content = part.get("text", "")[:800]
                                break
                    else:
                        content = str(msg_content)[:800]
                    frontend_type = "user_message" if role == "user" else "assistant_message"

                elif t == "user":
                    c = obj.get("content", "")
                    content = _extract_text(c)
                    frontend_type = "user_message"

                elif t == "assistant":
                    c = obj.get("content", "")
                    content = _extract_text(c)
                    frontend_type = "assistant_message"

                elif t in ("tool_call", "tool_use"):
                    content = obj.get("name", obj.get("tool", "unknown_tool"))
                    frontend_type = "tool_call"

                elif t in ("tool_result", "tool_response"):
                    c = obj.get("content", "")
                    content = str(c)[:300] if c else ""
                    frontend_type = "tool_result"

                elif t == "error":
                    content = obj.get("error", json.dumps(obj)[:200])
                    frontend_type = "error"

                else:
                    # Skip non-message types (session, model_change, thinking_level_change, custom)
                    if t in ("session", "model_change", "thinking_level_change", "custom"):
                        continue
                    content = json.dumps(obj)[:200]

                events.append({
                    "id": f"event-{i}",
                    "type": frontend_type,
                    "timestamp": ts_ms,
                    "content": content,
                    "agentId": "orchestrator",
                    "metadata": None,
                })
            except Exception:
                pass

    return events


def _extract_text(content) -> str:
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                return part.get("text", "")[:800]
        return ""
    return str(content)[:800]
