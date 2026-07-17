import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import redis.asyncio as aioredis
from ..database import get_db
from ..models_db import Agent, AgentSkill
from ..schemas import (
    AgentOut, AgentCreate, AgentStatusUpdate, RunTaskRequest, RunTaskResponse,
    AgentUpdate, SkillsAdd, SkillItem,
)
from ..config import settings

router = APIRouter()

def redis_client():
    return aioredis.from_url(settings.redis_url, decode_responses=True)

@router.get("/", response_model=list[AgentOut])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).options(selectinload(Agent.skills)).order_by(Agent.created_at))
    return result.scalars().all()

@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.skills), selectinload(Agent.work_log))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent

@router.post("/", response_model=AgentOut, status_code=201)
async def create_agent(body: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**body.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent

@router.post("/{agent_id}/run", response_model=RunTaskResponse)
async def run_task(agent_id: UUID, body: RunTaskRequest, db: AsyncSession = Depends(get_db)):
    from ..workers.agent_tasks import run_agent_task
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")

    task = run_agent_task.delay(
        str(agent_id),
        agent.name,
        body.task_type,
        body.task_input,
        agent.model,
    )
    return RunTaskResponse(task_id=task.id, agent_id=str(agent_id))


@router.patch("/{agent_id}/status", response_model=AgentOut)
async def update_status(agent_id: UUID, body: AgentStatusUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")

    agent.status = body.status
    if body.current_task is not None:
        agent.current_task = body.current_task
    await db.commit()
    await db.refresh(agent)

    r = redis_client()
    event = json.dumps({
        "type": "STATE_SNAPSHOT",
        "agent_id": str(agent_id),
        "data": {"status": body.status, "current_task": body.current_task},
        "timestamp": agent.updated_at.isoformat(),
    })
    await r.publish(f"agent:{agent_id}:events", event)
    await r.aclose()

    return agent


async def _get_agent_with_skills(agent_id: UUID, db: AsyncSession) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.skills))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(agent_id: UUID, body: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await _get_agent_with_skills(agent_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    return await _get_agent_with_skills(agent_id, db)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    await db.delete(agent)
    await db.commit()


@router.post("/{agent_id}/skills", response_model=AgentOut)
async def add_skills(agent_id: UUID, body: SkillsAdd, db: AsyncSession = Depends(get_db)):
    agent = await _get_agent_with_skills(agent_id, db)
    existing = {s.skill.lower() for s in agent.skills}
    for item in body.skills:
        if isinstance(item, str):
            name, prof = item, 50
        else:
            name, prof = item.skill, item.proficiency
        if not name or name.lower() in existing:
            continue
        existing.add(name.lower())
        db.add(AgentSkill(agent_id=agent_id, skill=name, proficiency=max(0, min(100, prof))))
    await db.commit()
    return await _get_agent_with_skills(agent_id, db)


@router.delete("/{agent_id}/skills/{skill_id}", status_code=204)
async def delete_skill(agent_id: UUID, skill_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentSkill).where(AgentSkill.id == skill_id, AgentSkill.agent_id == agent_id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill not found")
    await db.delete(skill)
    await db.commit()
