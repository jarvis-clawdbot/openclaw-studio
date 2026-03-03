"""
Cron Jobs Management API via openclaw CLI.
"""
from __future__ import annotations
import json
import subprocess
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


def _cli(*args) -> dict:
    result = subprocess.run(
        ["openclaw", "cron"] + list(args),
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "CLI error")
    try:
        return json.loads(result.stdout)
    except Exception:
        return {"output": result.stdout}


class CronSchedule(BaseModel):
    kind: str
    at: Optional[str] = None
    everyMs: Optional[int] = None
    anchorMs: Optional[int] = None
    expr: Optional[str] = None
    tz: Optional[str] = None


class CronPayload(BaseModel):
    kind: str
    text: Optional[str] = None
    message: Optional[str] = None
    model: Optional[str] = None
    timeoutSeconds: Optional[int] = None


class CronDelivery(BaseModel):
    mode: str = "none"
    channel: Optional[str] = None
    to: Optional[str] = None


class CronJobCreate(BaseModel):
    name: Optional[str] = None
    schedule: CronSchedule
    payload: CronPayload
    delivery: Optional[CronDelivery] = None
    sessionTarget: str = "isolated"
    enabled: bool = True


class CronJobUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("")
async def list_jobs(includeDisabled: bool = False):
    """List all cron jobs via CLI."""
    try:
        args = ["list", "--json"]
        if includeDisabled:
            args.append("--include-disabled")
        data = _cli(*args)
        return {"jobs": data.get("jobs", []), "total": data.get("total", 0)}
    except HTTPException:
        raise
    except Exception:
        return {"jobs": [], "total": 0}


@router.post("")
async def create_job(data: CronJobCreate):
    """Create a new cron job via CLI."""
    job_data = data.dict(exclude_none=True)
    result = subprocess.run(
        ["openclaw", "cron", "add", "--json", "--job", json.dumps(job_data)],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "Failed to create job")
    try:
        return json.loads(result.stdout)
    except Exception:
        return {"status": "created"}


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a cron job."""
    _cli("rm", job_id)
    return {"status": "deleted", "id": job_id}


@router.post("/{job_id}/run")
async def run_job(job_id: str):
    """Trigger a cron job immediately."""
    result = _cli("run", job_id, "--json")
    return {"status": "triggered", "result": result}


@router.patch("/{job_id}/enabled")
async def toggle_job(job_id: str, enabled: bool):
    """Enable or disable a cron job."""
    cmd = "enable" if enabled else "disable"
    _cli(cmd, job_id)
    return {"status": "updated", "id": job_id, "enabled": enabled}


@router.get("/{job_id}/runs")
async def get_job_runs(job_id: str):
    """Get job run history."""
    try:
        data = _cli("runs", job_id, "--json")
        return {"runs": data.get("runs", [])}
    except Exception:
        return {"runs": []}
