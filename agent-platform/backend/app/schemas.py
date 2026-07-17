from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator

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
    metadata_: dict = {}
    read: bool
    created_at: datetime
    from_agent_name: Optional[str] = None

    @model_validator(mode='after')
    def populate_names(self) -> 'AgentCommOut':
        if self.metadata_ and not self.from_agent_name:
            self.from_agent_name = self.metadata_.get("from_agent_name")
        return self

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
    model: str = "claude-sonnet-5"

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


class RunTaskRequest(BaseModel):
    task_type: str
    task_input: dict = {}
    model: str = "claude-sonnet-5"


class RunTaskResponse(BaseModel):
    task_id: str
    agent_id: str
    status: str = "queued"


class EvalResultOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    work_log_id: Optional[uuid.UUID] = None
    score: int
    reasoning: Optional[str] = None
    judge_model: str
    skill_updates: dict = {}
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
