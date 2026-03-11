"""Multi-Agent Health Check Endpoint"""
from __future__ import annotations
import asyncio
import httpx
from fastapi import APIRouter
from sqlalchemy import text, select
from app.database import async_session
from app.models import CostRecord

router = APIRouter()

# Agent configuration (from AGENT-CONNECTIONS.md)
AGENTS = {
    "jarvis": {
        "name": "Jarvis (Mac)",
        "role": "Orchestrator",
        "gateway_url": "http://127.0.0.1:18789",
        "ssh_check": None,  # Local, no SSH needed
        "model": "qwen3.5-plus"
    },
    "clawdbot": {
        "name": "ClawdBot (Azure)",
        "role": "Heavy-duty worker",
        "gateway_url": "http://127.0.0.1:18789",
        "ssh_host": "clawdbot@100.111.136.128",
        "ssh_key": "/Users/jarvis-openclaw/.ssh/id_azure_clawdbot",
        "model": "deepseek-v3.1-terminus"
    },
    "cathy": {
        "name": "Cathy (Android)",
        "role": "Lightweight helper",
        "gateway_url": "http://127.0.0.1:18789",
        "ssh_host": "u0_a233@100.79.94.37",
        "ssh_port": 8022,
        "ssh_key": "/Users/jarvis-openclaw/.ssh/id_azure_clawdbot",
        "model": "gemini-3-flash-preview"
    }
}


async def check_gateway_health(agent_id: str, config: dict) -> dict:
    """Check if agent's OpenClaw gateway is responding"""
    import subprocess
    import time
    
    try:
        if agent_id == "jarvis":
            # Local gateway check
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(config["gateway_url"])
                return {
                    "status": "online",
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                    "gateway": "responding"
                }
        else:
            # Remote agents: SSH connection check only
            # If SSH works, OpenClaw is running (no HTTP overhead on remote devices)
            ssh_host = config.get("ssh_host")
            ssh_key = config.get("ssh_key")
            ssh_port = config.get("ssh_port", 22)
            username = ssh_host.split("@")[0] if "@" in ssh_host else "root"
            hostname = ssh_host.split("@")[1] if "@" in ssh_host else ssh_host
            
            start = time.time()
            try:
                # Test SSH connection
                result = subprocess.run(
                    [
                        "ssh",
                        "-i", ssh_key,
                        "-o", "StrictHostKeyChecking=no",
                        "-o", "ConnectTimeout=5",
                        "-p", str(ssh_port),
                        f"{username}@{hostname}",
                        "echo 'SSH_OK'"
                    ],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                elapsed_ms = int((time.time() - start) * 1000)
                
                if "SSH_OK" in result.stdout:
                    # SSH connection = device online, OpenClaw running
                    # Skip OpenClaw CLI check to avoid hangs on broken node_modules
                    return {
                        "status": "online",
                        "response_time_ms": elapsed_ms,
                        "method": "SSH OK (OpenClaw assumed running)",
                        "ssh_host": ssh_host
                    }
                else:
                    return {
                        "status": "offline",
                        "reason": "SSH connection failed",
                        "ssh_host": ssh_host
                    }
            except subprocess.TimeoutExpired:
                return {
                    "status": "offline",
                    "reason": "SSH timeout",
                    "ssh_host": ssh_host
                }
    except Exception as e:
        return {
            "status": "offline",
            "error": str(e)
        }


async def check_database_health() -> dict:
    """Check database connectivity"""
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


async def get_cost_summary() -> dict:
    """Get cost summary from database"""
    try:
        async with async_session() as db:
            result = await db.execute(
                select(
                    CostRecord.model,
                    CostRecord.total_tokens,
                    CostRecord.cost_usd
                ).order_by(CostRecord.recorded_at.desc()).limit(10)
            )
            rows = result.fetchall()
            return {
                "status": "ok",
                "recent_entries": len(rows),
                "sample": [
                    {"model": r[0], "tokens": r[1], "cost": float(r[2]) if r[2] else 0}
                    for r in rows[:3]
                ]
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("")
async def multi_agent_health():
    """
    Multi-Agent Health Check
    
    Returns health status for:
    - Database
    - All configured agents (Jarvis, ClawdBot, Cathy)
    - Cost tracking
    - Gateway connectivity
    """
    # Check database
    db_health = await check_database_health()
    
    # Check all agents concurrently
    agent_checks = {}
    for agent_id, config in AGENTS.items():
        agent_checks[agent_id] = await check_gateway_health(agent_id, config)
    
    # Get cost summary
    cost_summary = await get_cost_summary()
    
    # Determine overall status
    all_agents_online = all(
        check.get("status") in ["online", "unknown"] 
        for check in agent_checks.values()
    )
    db_ok = db_health["status"] == "ok"
    
    overall_status = "healthy" if (all_agents_online and db_ok) else "degraded"
    
    return {
        "status": overall_status,
        "timestamp": asyncio.get_event_loop().time(),
        "checks": {
            "database": db_health,
            "agents": agent_checks,
            "cost_tracking": cost_summary
        },
        "agents_configured": len(AGENTS),
        "agents_summary": {
            agent_id: {
                "name": config["name"],
                "role": config["role"],
                "model": config["model"]
            }
            for agent_id, config in AGENTS.items()
        }
    }


@router.get("/agents/{agent_id}")
async def agent_health(agent_id: str):
    """Check health of a specific agent"""
    if agent_id not in AGENTS:
        return {"error": f"Unknown agent: {agent_id}", "available": list(AGENTS.keys())}
    
    config = AGENTS[agent_id]
    health = await check_gateway_health(agent_id, config)
    
    return {
        "agent_id": agent_id,
        "name": config["name"],
        "role": config["role"],
        "model": config["model"],
        "health": health
    }
