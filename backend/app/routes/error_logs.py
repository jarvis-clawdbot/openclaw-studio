"""Error Log Integration Endpoint"""
from __future__ import annotations
import os
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pathlib import Path

router = APIRouter()

ERROR_LOG_PATH = Path.home() / ".openclaw" / "workspace" / "error-log.md"


def parse_error_log(content: str) -> List[Dict[str, Any]]:
    """Parse error-log.md markdown into structured data"""
    errors = []
    current_error = {}
    
    # Split by error entries (### timestamp: description)
    entries = re.split(r'\n### ', content)
    
    for entry in entries[1:]:  # Skip header
        lines = entry.strip().split('\n')
        if not lines:
            continue
        
        # Parse header line
        header = lines[0]
        match = re.match(r'(\d{4}-\d{2}-\d{2}T[\d:]+[-+\d:]*): (.+)', header)
        if match:
            current_error['timestamp'] = match.group(1)
            current_error['title'] = match.group(2)
        
        # Parse metadata lines
        for line in lines[1:]:
            if line.startswith('**Error:**'):
                current_error['error'] = line.replace('**Error:**', '').strip()
            elif line.startswith('**Agent:**'):
                current_error['agent'] = line.replace('**Agent:**', '').strip()
            elif line.startswith('**Task:**'):
                current_error['task'] = line.replace('**Task:**', '').strip()
            elif line.startswith('**Resolution:**'):
                current_error['resolution'] = line.replace('**Resolution:**', '').strip()
            elif line.startswith('**Root Cause:**'):
                current_error['root_cause'] = line.replace('**Root Cause:**', '').strip()
            elif line.startswith('**Impact:**'):
                current_error['impact'] = line.replace('**Impact:**', '').strip()
        
        if current_error.get('timestamp'):
            errors.append(current_error.copy())
            current_error = {}
    
    return errors


@router.get("")
async def get_error_logs(limit: int = 50, agent: Optional[str] = None):
    """
    Get error logs from workspace
    
    Query params:
    - limit: Max errors to return (default: 50)
    - agent: Filter by agent name (optional)
    """
    if not ERROR_LOG_PATH.exists():
        return {"errors": [], "total": 0, "message": "No error log found"}
    
    try:
        content = ERROR_LOG_PATH.read_text()
        errors = parse_error_log(content)
        
        # Filter by agent if specified
        if agent:
            errors = [e for e in errors if e.get('agent', '').lower() == agent.lower()]
        
        # Sort by timestamp (newest first)
        errors.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Apply limit
        errors = errors[:limit]
        
        return {
            "errors": errors,
            "total": len(errors),
            "filtered_by": agent,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing log: {str(e)}")


@router.get("/stats")
async def get_error_stats():
    """Get error statistics"""
    if not ERROR_LOG_PATH.exists():
        return {"total": 0, "by_agent": {}, "by_impact": {}}
    
    try:
        content = ERROR_LOG_PATH.read_text()
        errors = parse_error_log(content)
        
        # Count by agent
        by_agent: Dict[str, int] = {}
        for error in errors:
            agent = error.get('agent', 'Unknown')
            by_agent[agent] = by_agent.get(agent, 0) + 1
        
        # Count by impact
        by_impact: Dict[str, int] = {}
        for error in errors:
            impact = error.get('impact', 'Unknown')
            by_impact[impact] = by_impact.get(impact, 0) + 1
        
        return {
            "total": len(errors),
            "by_agent": by_agent,
            "by_impact": by_impact,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating stats: {str(e)}")


@router.get("/recent")
async def get_recent_errors(count: int = 10):
    """Get most recent errors (simplified for dashboard widget)"""
    if not ERROR_LOG_PATH.exists():
        return {"errors": []}
    
    try:
        content = ERROR_LOG_PATH.read_text()
        errors = parse_error_log(content)
        errors.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return {"errors": errors[:count]}
    except Exception:
        return {"errors": []}
