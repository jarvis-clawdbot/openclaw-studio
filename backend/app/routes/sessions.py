"""
Sessions API - List and inspect OpenClaw sessions via CLI.
"""
from __future__ import annotations
import json
import subprocess
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class Session(BaseModel):
    sessionKey: str
    kind: Optional[str] = None
    label: Optional[str] = None
    agentId: Optional[str] = None
    createdAt: Optional[str] = None
    lastMessageAt: Optional[str] = None
    model: Optional[str] = None
    totalTokens: Optional[int] = None
    inputTokens: Optional[int] = None
    outputTokens: Optional[int] = None


def _run_cli(*args) -> dict:
    result = subprocess.run(
        ["openclaw"] + list(args),
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "CLI error")
    return json.loads(result.stdout)


@router.get("", response_model=List[Session])
async def list_sessions(all_agents: bool = False, active: Optional[int] = None):
    """List OpenClaw sessions via CLI."""
    try:
        args = ["sessions", "--json"]
        if all_agents:
            args.append("--all-agents")
        if active:
            args += ["--active", str(active)]
        data = _run_cli(*args)
        sessions = data.get("sessions", [])
        result = []
        for s in sessions:
            updated = s.get("updatedAt")
            result.append(Session(
                sessionKey=s.get("key", ""),
                kind=s.get("kind"),
                label=s.get("label"),
                agentId=s.get("agentId"),
                lastMessageAt=str(updated) if updated else None,
                model=s.get("model"),
                totalTokens=s.get("totalTokens"),
                inputTokens=s.get("inputTokens"),
                outputTokens=s.get("outputTokens"),
            ))
        return result
    except HTTPException:
        raise
    except Exception as e:
        return []
