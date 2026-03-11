"""
Agent Registry API - Version tracking, history, and rollback.

Endpoints:
- GET  /api/agents/registry          - List all agents with current versions + metrics
- GET  /api/agents/{id}/versions     - Version history for an agent
- POST /api/agents/{id}/rollback     - Rollback agent to a previous version
"""
from __future__ import annotations

import asyncio
import glob
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OPENCLAW_DIR = os.path.expanduser("~/.openclaw/agents")
AGENTS_CONF = os.path.expanduser("~/.openclaw/agents")

# ── Risk tier logic ────────────────────────────────────────────
RISK_TIERS: dict[str, str] = {
    "orchestrator": "high",
    "coder": "high",
    "reviewer": "medium",
    "researcher": "low",
    "planner": "low",
    "executor": "medium",
    "main": "high",
}

ROLE_MAP: dict[str, str] = {
    "orchestrator": "Orchestrator",
    "researcher": "Researcher",
    "coder": "Builder",
    "reviewer": "Reviewer",
    "planner": "Planner",
    "executor": "Executor",
    "main": "Main",
}

COLOR_MAP: dict[str, str] = {
    "orchestrator": "#8b5cf6",
    "researcher": "#3b82f6",
    "coder": "#10b981",
    "reviewer": "#f59e0b",
    "planner": "#ec4899",
    "executor": "#06b6d4",
    "main": "#ef4444",
}

# ── In-memory version store (simulated — real config history) ──
# Format: {agent_id: [{version, model, timestamp, commit_msg}]}
_version_store: dict[str, list] = {}
_registry_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 10.0


def _parse_agent_config(agent_id: str) -> dict:
    """Read agent config files to extract model, version, metadata."""
    agent_dir = os.path.join(OPENCLAW_DIR, agent_id, "agent")
    result: dict = {
        "model": None,
        "version": "1.0.0",
        "config_ts": None,
        "session_count": 0,
        "total_tokens": 0,
        "last_active": None,
    }

    # Read models.json for configured model
    models_path = os.path.join(agent_dir, "models.json")
    if os.path.exists(models_path):
        try:
            with open(models_path) as f:
                data = json.load(f)
            # Get the primary model from first provider
            for provider_data in data.get("providers", {}).values():
                models = provider_data.get("models", [])
                if models:
                    result["model"] = models[0].get("id")
                    break
            result["config_ts"] = datetime.fromtimestamp(
                os.path.getmtime(models_path), tz=timezone.utc
            ).isoformat()
        except Exception:
            pass

    # Count sessions & aggregate tokens
    sessions_dir = os.path.join(OPENCLAW_DIR, agent_id, "sessions")
    if os.path.isdir(sessions_dir):
        session_files = [f for f in glob.glob(os.path.join(sessions_dir, "*.jsonl"))
                         if ".reset." not in f]
        result["session_count"] = len(session_files)

        # Get last active time from most recent session
        if session_files:
            latest = max(session_files, key=os.path.getmtime)
            result["last_active"] = datetime.fromtimestamp(
                os.path.getmtime(latest), tz=timezone.utc
            ).isoformat()

            # Try to extract total tokens from tail of latest session
            try:
                with open(latest, "rb") as f:
                    f.seek(0, 2)
                    size = f.tell()
                    f.seek(max(0, size - 4096))
                    tail = f.read().decode("utf-8", errors="ignore")
                for line in reversed(tail.splitlines()):
                    if not line.strip():
                        continue
                    try:
                        obj = json.loads(line)
                        usage = obj.get("message", {}).get("usage") or obj.get("usage") or {}
                        if usage.get("totalTokens"):
                            result["total_tokens"] = usage["totalTokens"]
                            break
                    except Exception:
                        continue
            except Exception:
                pass

    return result


def _get_or_init_versions(agent_id: str, config: dict) -> list:
    """Get or create version history for an agent."""
    global _version_store
    if agent_id not in _version_store:
        # Bootstrap version history based on config timestamps
        model = config.get("model") or "unknown"
        ts_now = datetime.now(tz=timezone.utc).isoformat()
        ts_old = config.get("config_ts") or ts_now

        # Simulate realistic version history
        versions = []

        # Derive version from session count
        session_count = config.get("session_count", 0)
        major = 1
        minor = max(0, session_count // 10)
        patch = session_count % 10

        # v1.0.0 — initial
        versions.append({
            "version": "1.0.0",
            "model": model,
            "timestamp": ts_old,
            "commit_msg": "Initial agent configuration",
            "is_current": False,
            "change_type": "initial",
        })

        # If there have been sessions, add intermediate versions
        if session_count > 5:
            versions.append({
                "version": "1.1.0",
                "model": model,
                "timestamp": ts_old,
                "commit_msg": "Model provider update",
                "is_current": False,
                "change_type": "model_change",
            })

        # Current version
        current_version = f"{major}.{minor}.{patch}" if (minor or patch) else "1.0.0"
        if current_version == versions[0]["version"]:
            current_version = "1.0.0"

        if not any(v["version"] == current_version for v in versions):
            versions.append({
                "version": current_version,
                "model": model,
                "timestamp": ts_now,
                "commit_msg": "Current active configuration",
                "is_current": True,
                "change_type": "config_update",
            })
        else:
            versions[-1]["is_current"] = True

        _version_store[agent_id] = versions

    return _version_store[agent_id]


def _compute_metrics(agent_id: str, config: dict) -> dict:
    """Compute performance metrics for an agent."""
    session_count = config.get("session_count", 0)
    total_tokens = config.get("total_tokens", 0)
    last_active = config.get("last_active")

    # Derive uptime/activity score (0-100)
    activity_score = min(100, session_count * 10) if session_count else 0

    # Approximate cost (assuming $0 for free models, small number for display)
    approx_cost = round(total_tokens * 0.000001, 4)

    # Last active age
    last_active_seconds: int | None = None
    if last_active:
        try:
            dt = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
            last_active_seconds = int(time.time() - dt.timestamp())
        except Exception:
            pass

    return {
        "session_count": session_count,
        "total_tokens": total_tokens,
        "approx_cost_usd": approx_cost,
        "activity_score": activity_score,
        "last_active_seconds": last_active_seconds,
    }


# ── Pydantic models ────────────────────────────────────────────

class VersionEntry(BaseModel):
    version: str
    model: Optional[str]
    timestamp: str
    commit_msg: str
    is_current: bool
    change_type: str  # initial | model_change | config_update | rollback


class AgentMetrics(BaseModel):
    session_count: int
    total_tokens: int
    approx_cost_usd: float
    activity_score: int
    last_active_seconds: Optional[int]


class RegistryAgent(BaseModel):
    id: str
    name: str
    role: str
    model: Optional[str]
    current_version: str
    status: str  # active | idle | offline
    risk_tier: str  # low | medium | high
    avatar_color: str
    last_active: Optional[str]
    metrics: AgentMetrics
    versions: List[VersionEntry]


class RollbackRequest(BaseModel):
    version: str
    reason: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────

def _is_agent_active(last_active_seconds: int | None) -> str:
    if last_active_seconds is None:
        return "offline"
    if last_active_seconds < 300:
        return "active"
    return "idle"


async def _build_registry() -> list:
    """Build full registry with version info (cached 10s)."""
    global _registry_cache
    now_mono = time.monotonic()

    if _registry_cache["data"] is not None and (now_mono - _registry_cache["ts"]) < _CACHE_TTL:
        return _registry_cache["data"]

    # Discover agents from filesystem
    agent_ids = []
    if os.path.isdir(OPENCLAW_DIR):
        for entry in sorted(os.listdir(OPENCLAW_DIR)):
            if os.path.isdir(os.path.join(OPENCLAW_DIR, entry)):
                agent_ids.append(entry)

    # Also add agents from CLI if different
    try:
        proc = await asyncio.create_subprocess_exec(
            "openclaw", "agents", "list",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        if stdout:
            for line in stdout.decode().splitlines():
                line = line.strip()
                if line.startswith("- ") and "(" in line:
                    aid = line[2:].split("(")[0].strip().split()[0]
                    if aid and aid not in agent_ids:
                        agent_ids.append(aid)
    except Exception:
        pass

    loop = asyncio.get_event_loop()
    configs = await asyncio.gather(*[
        loop.run_in_executor(None, _parse_agent_config, aid)
        for aid in agent_ids
    ])

    result = []
    for agent_id, config in zip(agent_ids, configs):
        versions = _get_or_init_versions(agent_id, config)
        current_ver = next((v["version"] for v in versions if v.get("is_current")), versions[-1]["version"] if versions else "1.0.0")
        metrics_data = _compute_metrics(agent_id, config)
        status = _is_agent_active(metrics_data["last_active_seconds"])

        result.append({
            "id": agent_id,
            "name": agent_id.capitalize(),
            "role": ROLE_MAP.get(agent_id, "Agent"),
            "model": config.get("model"),
            "current_version": current_ver,
            "status": status,
            "risk_tier": RISK_TIERS.get(agent_id, "medium"),
            "avatar_color": COLOR_MAP.get(agent_id, "#6b7280"),
            "last_active": config.get("last_active"),
            "metrics": metrics_data,
            "versions": versions,
        })

    _registry_cache = {"data": result, "ts": now_mono}
    return result


# ── Routes ────────────────────────────────────────────────────

@router.get("/registry", response_model=List[RegistryAgent])
async def get_registry():
    """List all agents with current versions, metrics, and risk tiers."""
    return await _build_registry()


@router.get("/{agent_id}/versions", response_model=List[VersionEntry])
async def get_agent_versions(agent_id: str):
    """Get full version history for an agent."""
    registry = await _build_registry()
    agent = next((a for a in registry if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return agent["versions"]


@router.post("/{agent_id}/rollback")
async def rollback_agent(agent_id: str, body: RollbackRequest):
    """
    Rollback agent to a previous version.
    
    In a real system this would restore config from a git hash or config snapshot.
    Here we update the in-memory version store to mark the target as current.
    """
    registry = await _build_registry()
    agent = next((a for a in registry if a["id"] == agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    versions = _version_store.get(agent_id, [])
    target = next((v for v in versions if v["version"] == body.version), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Version '{body.version}' not found for agent '{agent_id}'")

    if target.get("is_current"):
        return {"status": "noop", "message": f"Agent {agent_id} is already at version {body.version}"}

    # Mark all as not current, set target as current
    previous_version = next((v["version"] for v in versions if v.get("is_current")), "unknown")
    for v in versions:
        v["is_current"] = False
    target["is_current"] = True

    # Add rollback record to version history
    rollback_entry = {
        "version": f"{target['version']}-rb",
        "model": target["model"],
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "commit_msg": f"Rollback to {body.version}" + (f": {body.reason}" if body.reason else ""),
        "is_current": True,
        "change_type": "rollback",
    }
    # Actually point to rolled-back version as current
    target["is_current"] = False
    rollback_entry["is_current"] = True
    _version_store[agent_id].append(rollback_entry)

    # Invalidate cache
    _registry_cache["data"] = None

    return {
        "status": "success",
        "agent_id": agent_id,
        "rolled_back_from": previous_version,
        "rolled_back_to": body.version,
        "reason": body.reason,
        "new_version": rollback_entry["version"],
    }
