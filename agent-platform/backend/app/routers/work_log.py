from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models_db import Agent, WorkLog, AgentSkill
from ..schemas import WorkLogOut, WorkLogCreate

router = APIRouter()

@router.get("/{agent_id}", response_model=list[WorkLogOut])
async def get_work_log(agent_id: UUID, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkLog)
        .where(WorkLog.agent_id == agent_id)
        .order_by(WorkLog.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()

@router.post("/{agent_id}", response_model=WorkLogOut, status_code=201)
async def create_work_log(agent_id: UUID, body: WorkLogCreate, db: AsyncSession = Depends(get_db)):
    agent_result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")

    entry = WorkLog(
        agent_id=agent_id,
        started_at=body.started_at or datetime.utcnow(),
        **{k: v for k, v in body.model_dump().items() if k != "started_at"},
    )
    db.add(entry)
    agent.task_count += 1
    if body.success:
        agent.success_count += 1

    if body.task_type:
        skill_result = await db.execute(
            select(AgentSkill).where(AgentSkill.agent_id == agent_id, AgentSkill.skill == body.task_type)
        )
        skill = skill_result.scalar_one_or_none()
        if skill:
            skill.times_used += 1
            skill.last_used = datetime.utcnow()
            skill.proficiency = min(100, skill.proficiency + (1 if body.success else 0))

    await db.commit()
    await db.refresh(entry)
    return entry
