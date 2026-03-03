from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class AgentBase(BaseModel):
    name: str
    role: str
    model: str
    avatar_color: str = "#6366f1"

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None
    session_key: Optional[str] = None
    avatar_color: Optional[str] = None

class AgentResponse(AgentBase):
    id: int
    status: str
    session_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "backlog"
    priority: str = "P2"
    source: str = "user"
    is_idea: bool = False

class TaskCreate(TaskBase):
    agent_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    agent_id: Optional[int] = None
    notion_page_id: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    agent_id: Optional[int] = None
    notion_page_id: Optional[str] = None
    notion_sync_status: str
    cost_usd: float
    tokens_used: int
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class AgentEventResponse(BaseModel):
    id: int
    agent_id: int
    session_key: Optional[str] = None
    event_type: str
    content: str
    tokens: int
    created_at: datetime
    class Config:
        from_attributes = True

class CostRecordResponse(BaseModel):
    id: int
    agent_id: Optional[int] = None
    task_id: Optional[int] = None
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    recorded_at: datetime
    class Config:
        from_attributes = True

class RecoveryActionResponse(BaseModel):
    id: int
    agent_id: int
    task_id: Optional[int] = None
    session_key: str
    action_type: str
    retry_count: int
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class RecoveryRespond(BaseModel):
    action: str

class UsageSummary(BaseModel):
    total_tokens: int
    total_cost: float
    agent_breakdown: Dict[str, Any]
    model_breakdown: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    gateway_connected: bool
    database: str
