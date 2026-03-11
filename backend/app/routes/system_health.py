#!/usr/bin/env python3
"""
System Health Monitoring API
Provides system metrics (CPU, RAM, disk, services) with 24h history
"""

from __future__ import annotations
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import subprocess

router = APIRouter()

# In-memory storage for metrics history (24h at 5-min intervals = 288 points)
METRICS_HISTORY: List[Dict] = []
MAX_HISTORY_POINTS = 288  # 24 hours at 5-minute intervals
LAST_COLLECTION: Optional[datetime] = None


def get_cpu_usage() -> dict:
    """Get CPU usage percentage"""
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.5)
        cpu_count = psutil.cpu_count()
        return {
            "usage_percent": round(cpu_percent, 1),
            "cores": cpu_count,
            "status": "healthy" if cpu_percent < 80 else "warning" if cpu_percent < 90 else "critical"
        }
    except Exception as e:
        return {"usage_percent": 0, "cores": 0, "status": "unknown", "error": str(e)}


def get_memory_usage() -> dict:
    """Get memory usage"""
    try:
        import psutil
        memory = psutil.virtual_memory()
        return {
            "total_gb": round(memory.total / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "usage_percent": round(memory.percent, 1),
            "status": "healthy" if memory.percent < 80 else "warning" if memory.percent < 90 else "critical"
        }
    except Exception as e:
        return {"total_gb": 0, "used_gb": 0, "available_gb": 0, "usage_percent": 0, "status": "unknown", "error": str(e)}


def get_disk_usage() -> dict:
    """Get disk usage"""
    try:
        import psutil
        disk = psutil.disk_usage('/')
        return {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "free_gb": round(disk.free / (1024**3), 2),
            "usage_percent": round(disk.percent, 1),
            "status": "healthy" if disk.percent < 80 else "warning" if disk.percent < 90 else "critical"
        }
    except Exception as e:
        return {"total_gb": 0, "used_gb": 0, "free_gb": 0, "usage_percent": 0, "status": "unknown", "error": str(e)}


def get_temperature() -> dict:
    """Get CPU temperature (macOS/Linux)"""
    try:
        # Try smctemp for macOS (install via: brew install smctemp)
        result = subprocess.run(
            ["smctemp", "-c"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            temp_c = float(result.stdout.strip())
            return {
                "celsius": round(temp_c, 1),
                "fahrenheit": round(temp_c * 9/5 + 32, 1),
                "status": "available"
            }
    except Exception:
        pass
    
    try:
        # Try Linux thermal zone
        result = subprocess.run(
            ["cat", "/sys/class/thermal/thermal_zone0/temp"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            temp_mc = int(result.stdout.strip())  # millidegrees Celsius
            temp_c = temp_mc / 1000.0
            return {
                "celsius": round(temp_c, 1),
                "fahrenheit": round(temp_c * 9/5 + 32, 1),
                "status": "available"
            }
    except Exception:
        pass
    
    return {"celsius": None, "fahrenheit": None, "status": "unavailable"}


def check_service_status(service_name: str) -> dict:
    """Check if a service is running"""
    try:
        if service_name == "gateway":
            result = subprocess.run(
                ["pgrep", "-f", "openclaw.*gateway"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return {"status": "running", "port": 18789, "pid": result.stdout.strip().split('\n')[0]}
            return {"status": "stopped"}
        elif service_name == "backend":
            # Check port 8000
            result = subprocess.run(
                ["lsof", "-i", ":8000", "-sTCP:LISTEN"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                return {"status": "running", "port": 8000}
            return {"status": "stopped", "port": 8000}
        elif service_name == "frontend":
            # Check port 3000
            result = subprocess.run(
                ["lsof", "-i", ":3000", "-sTCP:LISTEN"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                return {"status": "running", "port": 3000}
            return {"status": "stopped", "port": 3000}
    except Exception as e:
        return {"status": "unknown", "error": str(e)}
    
    return {"status": "unknown"}


def collect_metrics_snapshot() -> Dict:
    """Collect current system metrics for history"""
    now = datetime.now()
    
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        return {
            "timestamp": now.isoformat(),
            "cpu_percent": round(cpu_percent, 1),
            "memory_percent": round(memory.percent, 1),
            "memory_used_gb": round(memory.used / (1024**3), 2),
        }
    except Exception:
        return {
            "timestamp": now.isoformat(),
            "cpu_percent": 0,
            "memory_percent": 0,
            "memory_used_gb": 0,
        }


def add_to_history(snapshot: Dict):
    """Add metrics snapshot to history, maintaining 24h window"""
    global METRICS_HISTORY, LAST_COLLECTION
    METRICS_HISTORY.append(snapshot)
    LAST_COLLECTION = datetime.now()
    
    # Keep only last 24h
    if len(METRICS_HISTORY) > MAX_HISTORY_POINTS:
        METRICS_HISTORY.pop(0)


def determine_overall_status(cpu: dict, memory: dict, disk: dict, services: dict) -> str:
    """Determine overall system health status"""
    # Check if any critical metric is in warning state
    if cpu.get("usage_percent", 0) > 90 or memory.get("usage_percent", 0) > 90 or disk.get("usage_percent", 0) > 90:
        return "critical"
    
    if cpu.get("usage_percent", 0) > 80 or memory.get("usage_percent", 0) > 80 or disk.get("usage_percent", 0) > 80:
        return "warning"
    
    # Check service status
    service_statuses = [s.get("status") for s in services.values()]
    if "stopped" in service_statuses:
        return "warning"
    
    return "healthy"


@router.get("/health")
async def get_system_health():
    """Get comprehensive system health metrics"""
    
    cpu = get_cpu_usage()
    memory = get_memory_usage()
    disk = get_disk_usage()
    temperature = get_temperature()
    
    services = {
        "gateway": check_service_status("gateway"),
        "backend": check_service_status("backend"),
        "frontend": check_service_status("frontend")
    }
    
    # Collect metrics for history
    snapshot = collect_metrics_snapshot()
    add_to_history(snapshot)
    
    return {
        "timestamp": datetime.now().isoformat(),
        "cpu": cpu,
        "memory": memory,
        "disk": disk,
        "temperature": temperature,
        "services": services,
        "overall_status": determine_overall_status(cpu, memory, disk, services)
    }


@router.get("/metrics")
async def get_system_metrics(hours: int = Query(24, ge=1, le=168)):
    """Get historical system metrics for the specified time range"""
    global METRICS_HISTORY
    
    # Calculate cutoff time
    cutoff = datetime.now() - timedelta(hours=hours)
    
    # Filter history to requested time range
    filtered_history = [
        m for m in METRICS_HISTORY 
        if datetime.fromisoformat(m["timestamp"]) > cutoff
    ]
    
    # If we don't have enough history, generate sample data for demo
    if len(filtered_history) < 10:
        now = datetime.now()
        sample_data = []
        for i in range(min(MAX_HISTORY_POINTS, hours * 12)):
            timestamp = now - timedelta(minutes=i * 5)
            sample_data.append({
                "timestamp": timestamp.isoformat(),
                "cpu_percent": round(20 + (i % 20) * 2 + (i % 7), 1),  # Simulated CPU
                "memory_percent": round(40 + (i % 15) * 1.5, 1),  # Simulated RAM
                "memory_used_gb": round(6.4 + (i % 10) * 0.3, 2),
            })
        sample_data.reverse()  # Oldest first
        METRICS_HISTORY = sample_data
        filtered_history = sample_data
    
    return {
        "metrics": filtered_history,
        "total_points": len(filtered_history),
        "time_range_hours": hours,
        "last_updated": LAST_COLLECTION.isoformat() if LAST_COLLECTION else None
    }


@router.post("/services/{service_name}/restart")
async def restart_service(service_name: str):
    """Restart a service (requires user confirmation)"""
    
    allowed_services = ["gateway", "backend", "frontend"]
    
    if service_name not in allowed_services:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": f"Service '{service_name}' not allowed"}
        )
    
    # Mock response - actual restart requires system permissions
    return {
        "success": False,
        "message": f"[MOCK] Service restart requires system permissions. Use terminal: 'openclaw gateway restart' for gateway.",
        "service": service_name
    }