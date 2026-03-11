"""
Distributed Tracing API - Parse OpenClaw session transcripts for execution traces.

Endpoints:
  GET /api/traces?session_id=&limit=50  - List execution traces
  GET /api/traces/{id}                  - Get single trace with full tree
"""
from __future__ import annotations

import datetime
import glob
import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

AGENTS_DIR = "/Users/jarvis-openclaw/.openclaw/agents"
MAIN_SESSIONS_DIR = "/Users/jarvis-openclaw/.openclaw/sessions"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_ts(ts_str: str) -> int:
    """Parse ISO timestamp → milliseconds since epoch."""
    try:
        return int(
            datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp() * 1000
        )
    except Exception:
        return 0


def _find_jsonl(session_id: str) -> Optional[str]:
    """Locate the .jsonl file for a session id."""
    pattern = os.path.join(AGENTS_DIR, "*", "sessions", f"{session_id}.jsonl")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    if os.path.isdir(MAIN_SESSIONS_DIR):
        alt = os.path.join(MAIN_SESSIONS_DIR, f"{session_id}.jsonl")
        if os.path.exists(alt):
            return alt
    return None


def _agent_from_path(path: str) -> str:
    parts = path.replace(AGENTS_DIR + "/", "").split("/")
    if len(parts) >= 1 and parts[0]:
        return parts[0]
    return "unknown"


def _extract_text(content: Any) -> str:
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                return str(part.get("text", ""))
        return ""
    return str(content) if content else ""


def _tool_calls_from_content(content: Any) -> List[Dict]:
    """Extract tool_use blocks from an assistant message content list."""
    if not isinstance(content, list):
        return []
    calls = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "tool_use":
            calls.append({
                "id": part.get("id", ""),
                "name": part.get("name", "unknown"),
                "input": part.get("input", {}),
            })
    return calls


def _tool_results_from_content(content: Any) -> List[Dict]:
    """Extract tool_result blocks from a user message content list."""
    if not isinstance(content, list):
        return []
    results = []
    for part in content:
        if isinstance(part, dict) and part.get("type") == "tool_result":
            raw = part.get("content", "")
            if isinstance(raw, list):
                text = _extract_text(raw)
            else:
                text = str(raw) if raw else ""
            results.append({
                "tool_use_id": part.get("tool_use_id", ""),
                "output": text[:2000],
                "is_error": part.get("is_error", False),
            })
    return results


# ── Trace parsing ──────────────────────────────────────────────────────────────

def _parse_session_to_trace(filepath: str) -> Dict:
    """
    Parse a .jsonl session file into a structured trace object.

    Returns a dict with:
      id, session_id, agent_id, model, started_at, ended_at, duration_ms,
      total_tokens, input_tokens, output_tokens, cost,
      steps: list of {id, type, timestamp, latency_ms, tool_name, tool_input,
                       tool_output, tokens, text, role, parent_id}
    """
    agent_id = _agent_from_path(filepath)
    session_id = os.path.basename(filepath).replace(".jsonl", "")

    records: List[Dict] = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except Exception:
                        pass
    except Exception:
        return {}

    if not records:
        return {}

    # ── First pass: build timeline of steps ───────────────────────────────────
    steps: List[Dict] = []
    total_tokens = 0
    total_input = 0
    total_output = 0
    total_cost = 0.0
    model = None
    started_at: Optional[int] = None
    ended_at: Optional[int] = None

    # Track pending tool calls so we can pair them with results
    pending_tool_calls: Dict[str, Dict] = {}  # tool_use_id → step

    step_idx = 0
    prev_ts: Optional[int] = None

    for rec in records:
        rtype = rec.get("type", "")
        ts_str = rec.get("timestamp", "")
        ts_ms = _parse_ts(ts_str) if ts_str else 0

        if ts_ms and started_at is None:
            started_at = ts_ms
        if ts_ms:
            ended_at = ts_ms

        latency_ms = (ts_ms - prev_ts) if (prev_ts and ts_ms) else 0
        if ts_ms:
            prev_ts = ts_ms

        if rtype == "session":
            pass  # metadata only

        elif rtype == "custom" and rec.get("customType") == "model-snapshot":
            model = rec.get("data", {}).get("modelId") or rec.get("data", {}).get("modelApi")

        elif rtype == "message":
            msg = rec.get("message", {})
            role = msg.get("role", "")
            content = msg.get("content", "")
            usage = msg.get("usage", {})

            step_tokens = usage.get("totalTokens", 0) or 0
            step_input = usage.get("input", 0) or 0
            step_output = usage.get("output", 0) or 0
            step_cost = (usage.get("cost", {}) or {}).get("total", 0.0) or 0.0

            total_tokens += step_tokens
            total_input += step_input
            total_output += step_output
            total_cost += step_cost

            if not model:
                model = msg.get("model")

            if role == "user":
                # Check for tool results embedded in user message
                results = _tool_results_from_content(content)
                for res in results:
                    tid = res["tool_use_id"]
                    if tid in pending_tool_calls:
                        # Enrich the pending tool call step with its result
                        pending_tool_calls[tid]["tool_output"] = res["output"]
                        pending_tool_calls[tid]["is_error"] = res["is_error"]
                        del pending_tool_calls[tid]

                # Also emit a "user_message" step if there's text content
                text = _extract_text(content)
                if text and not results:
                    steps.append({
                        "id": f"step-{step_idx}",
                        "type": "user_message",
                        "role": "user",
                        "timestamp": ts_ms,
                        "latency_ms": latency_ms,
                        "text": text[:800],
                        "tokens": step_tokens,
                        "input_tokens": step_input,
                        "output_tokens": step_output,
                        "cost": step_cost,
                        "tool_name": None,
                        "tool_input": None,
                        "tool_output": None,
                        "is_error": False,
                        "parent_id": None,
                    })
                    step_idx += 1

            elif role == "assistant":
                # Extract text
                text = _extract_text(content)
                # Extract tool calls
                tool_calls = _tool_calls_from_content(content)

                if text:
                    steps.append({
                        "id": f"step-{step_idx}",
                        "type": "llm_response",
                        "role": "assistant",
                        "timestamp": ts_ms,
                        "latency_ms": latency_ms,
                        "text": text[:800],
                        "tokens": step_tokens,
                        "input_tokens": step_input,
                        "output_tokens": step_output,
                        "cost": step_cost,
                        "tool_name": None,
                        "tool_input": None,
                        "tool_output": None,
                        "is_error": False,
                        "parent_id": None,
                    })
                    step_idx += 1

                for tc in tool_calls:
                    step = {
                        "id": f"step-{step_idx}",
                        "type": "tool_call",
                        "role": "tool",
                        "timestamp": ts_ms,
                        "latency_ms": 0,  # will be filled when result arrives
                        "text": None,
                        "tokens": 0,
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "cost": 0.0,
                        "tool_name": tc["name"],
                        "tool_input": tc["input"],
                        "tool_output": None,
                        "is_error": False,
                        "parent_id": f"step-{step_idx - 1}" if step_idx > 0 else None,
                    }
                    steps.append(step)
                    if tc["id"]:
                        pending_tool_calls[tc["id"]] = step
                    step_idx += 1

    duration_ms = (ended_at - started_at) if (started_at and ended_at) else 0

    return {
        "id": session_id,
        "session_id": session_id,
        "agent_id": agent_id,
        "model": model,
        "started_at": started_at,
        "ended_at": ended_at,
        "duration_ms": duration_ms,
        "total_tokens": total_tokens,
        "input_tokens": total_input,
        "output_tokens": total_output,
        "cost": round(total_cost, 6),
        "step_count": len(steps),
        "tool_call_count": sum(1 for s in steps if s["type"] == "tool_call"),
        "steps": steps,
    }


def _scan_all_traces(limit: int = 50, session_id: Optional[str] = None) -> List[Dict]:
    """Scan all agent session files and build trace summaries."""
    pattern = os.path.join(AGENTS_DIR, "*", "sessions", "*.jsonl")
    files = glob.glob(pattern)
    if os.path.isdir(MAIN_SESSIONS_DIR):
        files += glob.glob(os.path.join(MAIN_SESSIONS_DIR, "*.jsonl"))

    # Filter by session_id if specified
    if session_id:
        files = [f for f in files if session_id in os.path.basename(f)]

    # Sort by modification time (newest first)
    files = sorted(files, key=os.path.getmtime, reverse=True)[:limit]

    traces = []
    for filepath in files:
        try:
            trace = _parse_session_to_trace(filepath)
            if trace:
                # Return summary (no steps) for list view
                summary = {k: v for k, v in trace.items() if k != "steps"}
                traces.append(summary)
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")

    return traces


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_traces(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
    agent_id: Optional[str] = Query(None, description="Filter by agent"),
    search: Optional[str] = Query(None, description="Search by session id or agent"),
):
    """List execution traces from OpenClaw session transcripts."""
    traces = _scan_all_traces(limit=limit * 2, session_id=session_id)

    if agent_id:
        traces = [t for t in traces if t.get("agent_id") == agent_id]

    if search:
        q = search.lower()
        traces = [
            t for t in traces
            if q in (t.get("session_id") or "").lower()
            or q in (t.get("agent_id") or "").lower()
            or q in (t.get("model") or "").lower()
        ]

    return traces[:limit]


@router.get("/{trace_id}")
async def get_trace(trace_id: str):
    """Get a single trace with the full step tree."""
    filepath = _find_jsonl(trace_id)
    if not filepath:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found")

    trace = _parse_session_to_trace(filepath)
    if not trace:
        raise HTTPException(status_code=500, detail="Failed to parse trace")

    return trace
