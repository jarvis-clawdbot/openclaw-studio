"""
Nodes API - Manage paired devices.

Endpoints:
- GET /api/nodes - List paired nodes
- GET /api/nodes/{node_id} - Get node details
- POST /api/nodes/{node_id}/notify - Send notification
- POST /api/nodes/{node_id}/camera - Take photo
- POST /api/nodes/{node_id}/location - Get location
"""

from __future__ import annotations

import json
import urllib.request
from typing import Optional, List, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

GATEWAY_URL = "http://localhost:18789"


class Node(BaseModel):
    id: str
    name: str
    platform: Optional[str] = None
    version: Optional[str] = None
    lastSeen: Optional[str] = None
    capabilities: Optional[List[str]] = None


class NotifyRequest(BaseModel):
    title: str
    body: str
    priority: str = "active"


class CameraRequest(BaseModel):
    facing: str = "back"
    maxWidth: Optional[int] = 1920
    quality: Optional[int] = 85


def _gateway_request(method: str, path: str, data: Any = None) -> Any:
    """Make request to OpenClaw Gateway."""
    try:
        url = f"{GATEWAY_URL}{path}"
        headers = {"Content-Type": "application/json"}
        
        if data:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers=headers,
                method=method,
            )
        else:
            req = urllib.request.Request(url, headers=headers, method=method)
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=e.code, detail=e.read().decode())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")


@router.get("", response_model=List[Node])
async def list_nodes():
    """List all paired nodes."""
    try:
        result = _gateway_request("POST", "/api/nodes", {"action": "status"})
        nodes = result.get("nodes", [])
        return [Node(**n) for n in nodes]
    except Exception:
        return []


@router.get("/{node_id}", response_model=Node)
async def get_node(node_id: str):
    """Get node details."""
    result = _gateway_request("POST", "/api/nodes", {
        "action": "describe",
        "node": node_id,
    })
    return Node(**result.get("node", {}))


@router.post("/{node_id}/notify")
async def send_notification(node_id: str, data: NotifyRequest):
    """Send notification to node."""
    result = _gateway_request("POST", "/api/nodes", {
        "action": "notify",
        "node": node_id,
        "title": data.title,
        "body": data.body,
        "priority": data.priority,
    })
    return result


@router.post("/{node_id}/camera")
async def take_photo(node_id: str, data: CameraRequest):
    """Take photo with node camera."""
    result = _gateway_request("POST", "/api/nodes", {
        "action": "camera_snap",
        "node": node_id,
        "facing": data.facing,
        "maxWidth": data.maxWidth,
        "quality": data.quality,
    })
    return result


@router.post("/{node_id}/location")
async def get_location(node_id: str):
    """Get node location."""
    result = _gateway_request("POST", "/api/nodes", {
        "action": "location_get",
        "node": node_id,
    })
    return result
