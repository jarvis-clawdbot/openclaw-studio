"""
Memory API - Search agent memory via openclaw CLI.
"""
from __future__ import annotations
import json
import subprocess
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class MemorySearchRequest(BaseModel):
    query: str
    maxResults: Optional[int] = 10
    minScore: Optional[float] = 0.0


class MemorySearchResult(BaseModel):
    path: str
    lines: str
    score: float
    snippet: str


@router.post("/search", response_model=List[MemorySearchResult])
async def search_memory(data: MemorySearchRequest):
    """Search agent memory using openclaw CLI."""
    try:
        result = subprocess.run(
            ["openclaw", "memory", "search", data.query, "--json"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return []
        parsed = json.loads(result.stdout)
        results = parsed.get("results", [])
        out = []
        for r in results:
            score = r.get("score", 0)
            if score >= (data.minScore or 0):
                out.append(MemorySearchResult(
                    path=r.get("path", ""),
                    lines=f"{r.get('startLine', 0)}-{r.get('endLine', 0)}",
                    score=score,
                    snippet=r.get("snippet", ""),
                ))
        return out[:data.maxResults or 10]
    except Exception:
        return []


@router.get("/status")
async def memory_status():
    """Get memory index status."""
    try:
        result = subprocess.run(
            ["openclaw", "memory", "status", "--json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return {"status": "unknown"}
    except Exception:
        return {"status": "error"}
