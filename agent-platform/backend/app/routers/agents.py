import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import redis.asyncio as aioredis
from ..database import get_db
from ..models_db import Agent
from ..schemas import AgentOut, AgentCreate, AgentStatusUpdate
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
