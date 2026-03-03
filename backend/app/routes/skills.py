"""
Skills Marketplace API - Discover and install OpenClaw skills.

Endpoints:
- GET /api/skills - List available skills (from clawhub.com or local)
- GET /api/skills/{skill_id} - Get skill details
- POST /api/skills/{skill_id}/install - Install a skill
- GET /api/skills/installed - List installed skills
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import urllib.request
import urllib.error

router = APIRouter()

CLAWHUB_URL = "https://clawhub.com/api/skills"
SKILLS_DIR = os.path.expanduser("~/.openclaw/skills")


class SkillSummary(BaseModel):
    id: str
    name: str
    description: str
    author: str
    version: str
    tags: List[str] = []
    installed: bool = False


class SkillDetail(SkillSummary):
    readme: Optional[str] = None
    repo_url: Optional[str] = None
    dependencies: List[str] = []


class InstalledSkill(BaseModel):
    id: str
    name: str
    version: str
    installed_at: datetime
    path: str


@router.get("", response_model=List[SkillSummary])
async def list_skills(query: Optional[str] = None, tag: Optional[str] = None):
    """List available skills from ClawHub."""
    try:
        req = urllib.request.Request(f"{CLAWHUB_URL}?limit=50")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        
        # Get installed skills
        installed_ids = set()
        if os.path.exists(SKILLS_DIR):
            for name in os.listdir(SKILLS_DIR):
                manifest = os.path.join(SKILLS_DIR, name, "skill.json")
                if os.path.exists(manifest):
                    with open(manifest) as f:
                        m = json.load(f)
                        installed_ids.add(m.get("id", name))
        
        skills = []
        for item in data.get("skills", data if isinstance(data, list) else []):
            skill = SkillSummary(
                id=item.get("id", item.get("name", "")),
                name=item.get("name", ""),
                description=item.get("description", ""),
                author=item.get("author", "unknown"),
                version=item.get("version", "0.0.1"),
                tags=item.get("tags", []),
                installed=item.get("id", item.get("name", "")) in installed_ids,
            )
            # Filter
            if query and query.lower() not in skill.name.lower() and query.lower() not in skill.description.lower():
                continue
            if tag and tag not in skill.tags:
                continue
            skills.append(skill)
        
        return skills
    except Exception as e:
        # Fallback: return some known skills
        return [
            SkillSummary(id="canary", name="Canary", description="Secrets scanner for OpenClaw", author="openclaw", version="1.0.0", tags=["security"], installed=os.path.exists(os.path.join(SKILLS_DIR, "canary"))),
            SkillSummary(id="agent-audit", name="Agent Audit", description="Audit agent costs and performance", author="openclaw", version="1.0.0", tags=["analytics"], installed=os.path.exists(os.path.join(SKILLS_DIR, "agent-audit"))),
            SkillSummary(id="tavily", name="Tavily Search", description="AI-optimized web search", author="openclaw", version="1.0.0", tags=["search"], installed=os.path.exists(os.path.join(SKILLS_DIR, "tavily"))),
        ]


@router.get("/installed", response_model=List[InstalledSkill])
async def list_installed():
    """List installed skills."""
    skills = []
    if not os.path.exists(SKILLS_DIR):
        return skills
    
    for name in os.listdir(SKILLS_DIR):
        skill_path = os.path.join(SKILLS_DIR, name)
        manifest = os.path.join(skill_path, "skill.json")
        if os.path.exists(manifest):
            with open(manifest) as f:
                m = json.load(f)
            skills.append(InstalledSkill(
                id=m.get("id", name),
                name=m.get("name", name),
                version=m.get("version", "0.0.1"),
                installed_at=datetime.fromtimestamp(os.path.getmtime(manifest)),
                path=skill_path,
            ))
    
    return skills


@router.get("/{skill_id}", response_model=SkillDetail)
async def get_skill(skill_id: str):
    """Get skill details."""
    try:
        req = urllib.request.Request(f"{CLAWHUB_URL}/{skill_id}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        
        return SkillDetail(
            id=data.get("id", skill_id),
            name=data.get("name", skill_id),
            description=data.get("description", ""),
            author=data.get("author", "unknown"),
            version=data.get("version", "0.0.1"),
            tags=data.get("tags", []),
            readme=data.get("readme"),
            repo_url=data.get("repo_url"),
            dependencies=data.get("dependencies", []),
            installed=os.path.exists(os.path.join(SKILLS_DIR, skill_id)),
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Skill not found")


@router.post("/{skill_id}/install")
async def install_skill(skill_id: str):
    """Install a skill from ClawHub."""
    # In a real implementation, this would clone/download the skill
    # For now, return a message
    return {
        "status": "simulated",
        "message": f"Skill {skill_id} would be installed from ClawHub",
        "note": "Run: openclaw skill install {skill_id} to actually install",
    }


@router.delete("/{skill_id}")
async def uninstall_skill(skill_id: str):
    """Uninstall a skill."""
    skill_path = os.path.join(SKILLS_DIR, skill_id)
    if not os.path.exists(skill_path):
        raise HTTPException(status_code=404, detail="Skill not installed")
    
    import shutil
    shutil.rmtree(skill_path)
    return {"status": "uninstalled", "id": skill_id}
