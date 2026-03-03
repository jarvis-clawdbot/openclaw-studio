"""
Exec Approvals API - Handle live shell command approvals.

Endpoints:
- POST /api/exec-approvals/{approval_id}/decide - Submit approval decision
- GET /api/exec-approvals/pending - List pending approvals
"""

from __future__ import annotations

import json
import urllib.request
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

GATEWAY_URL = "http://localhost:18789"


class ExecApprovalDecision(BaseModel):
    decision: str  # "allow-once" | "allow-always" | "deny"
    session_key: Optional[str] = None
    agent_id: Optional[str] = None


class PendingApproval(BaseModel):
    id: str
    agent_id: Optional[str]
    session_key: Optional[str]
    command: str
    cwd: Optional[str]
    host: Optional[str]
    security: Optional[str]
    created_at_ms: int
    expires_at_ms: int


@router.post("/{approval_id}/decide")
async def decide_approval(approval_id: str, decision: ExecApprovalDecision):
    """Submit approval decision to gateway."""
    try:
        url = f"{GATEWAY_URL}/api/exec-approvals/{approval_id}/decide"
        data = json.dumps(decision.dict(exclude_none=True)).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")


@router.get("/pending", response_model=List[PendingApproval])
async def list_pending():
    """List pending exec approvals from gateway."""
    try:
        url = f"{GATEWAY_URL}/api/exec-approvals/pending"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return [PendingApproval(**item) for item in data.get("approvals", [])]
    except Exception:
        return []
