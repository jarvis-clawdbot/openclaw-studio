"""
Memory Browser API - Browse MEMORY.md and daily logs with search.
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

WORKSPACE = Path("/Users/jarvis-openclaw/.openclaw/workspace")
MEMORY_ROOT = WORKSPACE
MEMORY_DIR = WORKSPACE / "memory"


def _safe_path(rel_path: str) -> Path:
    """Resolve a relative path safely within workspace."""
    # Strip leading slashes / dots
    clean = rel_path.lstrip("/").lstrip("./")
    resolved = (WORKSPACE / clean).resolve()
    # Must stay within workspace
    if not str(resolved).startswith(str(WORKSPACE.resolve())):
        raise HTTPException(status_code=400, detail="Path outside workspace")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {rel_path}")
    return resolved


def _file_meta(path: Path, rel_base: Path) -> dict:
    """Build metadata dict for a file."""
    rel = str(path.relative_to(rel_base))
    stat = path.stat()
    size = stat.st_size
    modified = datetime.fromtimestamp(stat.st_mtime).isoformat()

    # Categorize
    name = path.name
    if name == "MEMORY.md":
        category = "long-term"
    elif re.match(r"\d{4}-\d{2}-\d{2}\.md$", name):
        category = "daily"
    elif re.match(r"\d{4}-\d{2}-\d{2}-", name):
        category = "investigation"
    elif name.endswith(".md"):
        category = "note"
    elif name.endswith(".json"):
        category = "data"
    else:
        category = "other"

    return {
        "name": name,
        "path": rel,
        "size": size,
        "modified": modified,
        "category": category,
    }


@router.get("/files")
async def list_memory_files():
    """List all memory files — MEMORY.md + memory/*.md"""
    files = []

    # Root MEMORY.md
    root_md = WORKSPACE / "MEMORY.md"
    if root_md.exists():
        files.append(_file_meta(root_md, WORKSPACE))

    # Other root-level .md worth surfacing
    for name in ["SESSION-STATE.md", "ACTIVE-TASK.md"]:
        p = WORKSPACE / name
        if p.exists():
            files.append(_file_meta(p, WORKSPACE))

    # memory/ directory
    if MEMORY_DIR.exists():
        memory_files = sorted(MEMORY_DIR.iterdir(), key=lambda f: f.name, reverse=True)
        for f in memory_files:
            if f.is_file() and f.suffix in (".md", ".json", ".txt"):
                files.append(_file_meta(f, WORKSPACE))

    return {"files": files, "total": len(files)}


@router.get("/content")
async def get_file_content(path: str = Query(..., description="Relative path within workspace")):
    """Get content of a memory file."""
    resolved = _safe_path(path)

    try:
        content = resolved.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    stat = resolved.stat()
    lines = content.count("\n") + 1
    size = stat.st_size
    modified = datetime.fromtimestamp(stat.st_mtime).isoformat()

    # Derive category
    name = resolved.name
    if name == "MEMORY.md":
        category = "long-term"
    elif re.match(r"\d{4}-\d{2}-\d{2}\.md$", name):
        category = "daily"
    elif re.match(r"\d{4}-\d{2}-\d{2}-", name):
        category = "investigation"
    else:
        category = "note"

    return {
        "path": path,
        "name": name,
        "content": content,
        "lines": lines,
        "size": size,
        "modified": modified,
        "category": category,
    }


@router.get("/search")
async def search_memory_files(
    q: str = Query(..., min_length=1, description="Search query"),
    max_results: int = Query(default=50, le=200),
):
    """Full-text search across all memory files."""
    query_lower = q.lower()
    results = []

    # All files to search
    candidates: List[Path] = []
    root_md = WORKSPACE / "MEMORY.md"
    if root_md.exists():
        candidates.append(root_md)
    for name in ["SESSION-STATE.md", "ACTIVE-TASK.md"]:
        p = WORKSPACE / name
        if p.exists():
            candidates.append(p)
    if MEMORY_DIR.exists():
        for f in MEMORY_DIR.iterdir():
            if f.is_file() and f.suffix in (".md", ".txt"):
                candidates.append(f)

    for filepath in candidates:
        try:
            content = filepath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        lines = content.splitlines()
        matching_lines = []
        for i, line in enumerate(lines):
            if query_lower in line.lower():
                # Grab context: 1 line before + after
                start = max(0, i - 1)
                end = min(len(lines), i + 2)
                snippet = "\n".join(lines[start:end])
                matching_lines.append({
                    "line_number": i + 1,
                    "line": line.strip(),
                    "snippet": snippet,
                })

        if matching_lines:
            rel = str(filepath.relative_to(WORKSPACE))
            results.append({
                "file": rel,
                "name": filepath.name,
                "match_count": len(matching_lines),
                "matches": matching_lines[:10],  # cap per file
            })

    # Sort by match count desc
    results.sort(key=lambda x: x["match_count"], reverse=True)

    return {
        "query": q,
        "total_files_matched": len(results),
        "results": results[:max_results],
    }


@router.get("/timeline")
async def get_session_timeline(
    session: Optional[str] = Query(default=None, description="Filter by session/date prefix"),
    days: int = Query(default=30, le=365),
):
    """Session activity timeline from daily log files."""
    timeline = []

    if not MEMORY_DIR.exists():
        return {"timeline": [], "total": 0}

    # Collect all daily logs
    daily_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")
    daily_files = []

    for f in MEMORY_DIR.iterdir():
        if not f.is_file():
            continue
        m = daily_pattern.match(f.name)
        if m:
            date_str = m.group(1)
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d")
                daily_files.append((date, f))
            except ValueError:
                continue

    # Sort descending, limit by days
    daily_files.sort(key=lambda x: x[0], reverse=True)
    daily_files = daily_files[:days]

    if session:
        daily_files = [(d, f) for d, f in daily_files if session in f.name]

    for date, filepath in daily_files:
        try:
            content = filepath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        lines = content.splitlines()

        # Extract key metadata from daily log
        sessions_found = []
        models_found = []
        focus_lines = []
        completed_items = []
        total_lines = len(lines)

        for line in lines:
            # Session start marker
            if "Session Start:" in line or "session start" in line.lower():
                sessions_found.append(line.strip())
            # Model info
            if "**Model:**" in line or "Model:" in line:
                models_found.append(line.strip())
            # Focus
            if "**Focus:**" in line or "Focus:" in line:
                focus_lines.append(line.strip())
            # Completed items (✅)
            if line.strip().startswith("✅") or "COMPLETED" in line.upper():
                completed_items.append(line.strip()[:80])

        # Build summary from first 5 lines of content
        summary_lines = [l for l in lines[:15] if l.strip() and not l.startswith("#")]
        summary = " ".join(summary_lines[:3])[:200]

        timeline.append({
            "date": date.strftime("%Y-%m-%d"),
            "file": filepath.name,
            "path": str(filepath.relative_to(WORKSPACE)),
            "lines": total_lines,
            "size": filepath.stat().st_size,
            "sessions": sessions_found[:3],
            "models": models_found[:2],
            "focus": focus_lines[:2],
            "completed": completed_items[:5],
            "summary": summary,
        })

    return {
        "timeline": timeline,
        "total": len(timeline),
        "days_covered": days,
    }
