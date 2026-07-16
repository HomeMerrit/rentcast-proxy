from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..database import get_db
from ..models_db import EvalResult, AgentConfig, Agent
from ..schemas import EvalResultOut

router = APIRouter()


@router.get("/{agent_id}/evals", response_model=list[EvalResultOut])
async def list_evals(agent_id: UUID, limit: int = 20, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(EvalResult).where(EvalResult.agent_id == agent_id)
        .order_by(EvalResult.created_at.desc()).limit(limit)
    )
    return r.scalars().all()


@router.get("/{agent_id}/evals/summary")
async def eval_summary(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(
            func.avg(EvalResult.score).label("avg_score"),
            func.count(EvalResult.id).label("total"),
            func.min(EvalResult.score).label("min_score"),
            func.max(EvalResult.score).label("max_score"),
        ).where(EvalResult.agent_id == agent_id)
    )
    row = r.one()
    # Get recent trend (last 5 scores)
    r2 = await db.execute(
        select(EvalResult.score, EvalResult.created_at).where(EvalResult.agent_id == agent_id)
        .order_by(EvalResult.created_at.desc()).limit(5)
    )
    recent = [{"score": s, "created_at": t.isoformat()} for s, t in r2.all()]
    return {
        "avg_score": round(float(row.avg_score or 0), 1),
        "total_evals": row.total,
        "min_score": row.min_score or 0,
        "max_score": row.max_score or 0,
        "recent": recent,
    }


@router.get("/{agent_id}/config")
async def get_agent_config(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(AgentConfig).where(
            AgentConfig.agent_id == agent_id,
            AgentConfig.config_type == "system_prompt",
            AgentConfig.active == True,  # noqa: E712
        ).order_by(AgentConfig.generation.desc()).limit(1)
    )
    config = r.scalar_one_or_none()
    if not config:
        return {"generation": 0, "active": False, "value": None}
    return {
        "id": str(config.id),
        "generation": config.generation,
        "eval_score": config.eval_score,
        "active": config.active,
        "value": config.value[:200] + "..." if len(config.value) > 200 else config.value,
        "created_at": config.created_at.isoformat(),
    }


@router.post("/{agent_id}/evolve")
async def trigger_evolution(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = r.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    from ..workers.agent_tasks import run_evolution_for_agent
    run_evolution_for_agent.delay(str(agent_id), agent.name, agent.title)
    return {"status": "evolution_triggered", "agent_id": str(agent_id)}
