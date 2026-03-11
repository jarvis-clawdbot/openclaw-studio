"""
Cron Jobs Management API via openclaw CLI.
"""
from __future__ import annotations
import json
import subprocess
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


def _cli(*args, parse_json: bool = True) -> Any:
    """Run openclaw cron <args> and return parsed output."""
    result = subprocess.run(
        ["openclaw", "cron"] + list(args),
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "CLI error")
    if not parse_json:
        return result.stdout
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
async def list_jobs(includeDisabled: bool = Query(False)):
    """List all cron jobs via CLI."""
    try:
        args = ["list", "--json"]
        if includeDisabled:
            args.append("--all")
        data = _cli(*args)
        jobs = data if isinstance(data, list) else data.get("jobs", [])
        return {"jobs": jobs, "total": len(jobs)}
    except HTTPException:
        raise
    except Exception as e:
        return {"jobs": [], "total": 0, "error": str(e)}


@router.post("")
async def create_job(data: CronJobCreate):
    """Create a new cron job via CLI."""
    args = ["cron", "add", "--json"]

    if data.name:
        args += ["--name", data.name]

    # Schedule
    s = data.schedule
    if s.kind == "cron" and s.expr:
        args += ["--cron", s.expr]
        if s.tz:
            args += ["--tz", s.tz]
    elif s.kind == "at" and s.at:
        args += ["--at", s.at]
    elif s.kind == "every" and s.everyMs:
        # Convert ms to seconds string
        secs = s.everyMs // 1000
        args += ["--every", f"{secs}s"]

    # Payload
    p = data.payload
    if p.kind == "systemEvent" and p.text:
        args += ["--system-event", p.text]
        args += ["--session", "main"]
    elif p.kind == "agentTurn":
        if p.message:
            args += ["--message", p.message]
        args += ["--session", "isolated"]
        if p.model:
            args += ["--model", p.model]

    if not data.enabled:
        args.append("--disabled")

    result = subprocess.run(
        ["openclaw"] + args,
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "Failed to create job")
    try:
        return json.loads(result.stdout)
    except Exception:
        return {"status": "created"}
    except Exception:
        return {"status": "created"}


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a cron job."""
    _cli("rm", job_id, parse_json=False)
    return {"status": "deleted", "id": job_id}


@router.post("/{job_id}/run")
async def run_job(job_id: str):
    """Trigger a cron job immediately."""
    result = subprocess.run(
        ["openclaw", "cron", "run", job_id],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "Failed to trigger job")
    return {"status": "triggered", "id": job_id}


@router.patch("/{job_id}/enabled")
async def toggle_job(job_id: str, enabled: bool):
    """Enable or disable a cron job."""
    cmd = "enable" if enabled else "disable"
    _cli(cmd, job_id, parse_json=False)
    return {"status": "updated", "id": job_id, "enabled": enabled}


@router.post("/{job_id}/toggle")
async def toggle_job_post(job_id: str, enabled: bool):
    """Enable or disable a cron job (POST variant)."""
    cmd = "enable" if enabled else "disable"
    _cli(cmd, job_id, parse_json=False)
    return {"status": "updated", "id": job_id, "enabled": enabled}


@router.get("/{job_id}/runs")
async def get_job_runs(job_id: str, limit: int = Query(10)):
    """Get job run history (last N executions)."""
    try:
        result = subprocess.run(
            ["openclaw", "cron", "runs", "--id", job_id, "--limit", str(limit)],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return {"runs": []}
        try:
            data = json.loads(result.stdout)
            runs = data if isinstance(data, list) else data.get("entries", data.get("runs", []))
            return {"runs": runs}
        except Exception:
            return {"runs": []}
    except Exception:
        return {"runs": []}


@router.get("/status")
async def get_status():
    """Get cron scheduler status."""
    try:
        result = subprocess.run(
            ["openclaw", "cron", "status", "--json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return {"status": "unknown"}
    except Exception:
        return {"status": "unknown"}
