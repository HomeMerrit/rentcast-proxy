from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AgentSkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    skill: str
    proficiency: int
    times_used: int
    last_used: Optional[datetime] = None

class WorkLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_type: str
    task_input: dict
    result: Optional[str] = None
    reflection: Optional[str] = None
    success: bool
    tokens_used: int
    duration_ms: Optional[int] = None
    started_at: datetime
    finished_at: Optional[datetime] = None

class AgentCommOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    from_agent_id: Optional[uuid.UUID] = None
    to_agent_id: Optional[uuid.UUID] = None
    message: str
    message_type: str
    read: bool
    created_at: datetime

class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    title: str
    department: str
    bio: Optional[str] = None
    avatar_seed: str
    model: str
    status: str
    current_task: Optional[str] = None
    task_count: int
    success_count: int
    created_at: datetime
    updated_at: datetime
    skills: list[AgentSkillOut] = []

class AgentCreate(BaseModel):
    name: str
    title: str
    department: str
    bio: Optional[str] = None
    avatar_seed: str
    model: str = "claude-sonnet-5-20251001"

class AgentStatusUpdate(BaseModel):
    status: str
    current_task: Optional[str] = None

class WorkLogCreate(BaseModel):
    task_type: str
    task_input: dict = {}
    result: Optional[str] = None
    reflection: Optional[str] = None
    success: bool = False
    tokens_used: int = 0
    duration_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

class CommCreate(BaseModel):
    from_agent_id: Optional[uuid.UUID] = None
    to_agent_id: Optional[uuid.UUID] = None
    message: str
    message_type: str = "message"
