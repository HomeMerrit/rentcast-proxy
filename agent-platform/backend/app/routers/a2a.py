"""A2A (Agent-to-Agent) Protocol endpoints."""
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..database import get_db
from ..models_db import Agent
from ..config import settings

router = APIRouter()


def _build_agent_card(agent: Agent, base_url: str) -> dict:
    return {
        "name": agent.name,
        "description": agent.bio or f"{agent.title} in {agent.department}",
        "url": f"{base_url}/agents/{agent.id}/a2a",
        "version": "1.0.0",
        "capabilities": {"streaming": True, "pushNotifications": False},
        "skills": [
            {
                "id": s.skill.lower().replace(" ", "_"),
                "name": s.skill,
                "description": f"Proficiency: {s.proficiency}%",
            }
            for s in (agent.skills or [])
        ],
        "authentication": {"schemes": []},
        "metadata": {
            "department": agent.department,
            "title": agent.title,
            "model": agent.model,
            "status": agent.status,
        },
    }


@router.get("/.well-known/agent-card.json")
async def platform_agent_card(db: AsyncSession = Depends(get_db)):
    """Platform-level A2A agent card listing all agents."""
    result = await db.execute(
        select(Agent).options(selectinload(Agent.skills)).order_by(Agent.created_at)
    )
    agents = result.scalars().all()
    base_url = "http://localhost:8000"
    return {
        "name": "AgentOS Platform",
        "description": "Multi-agent AI platform",
        "url": f"{base_url}/a2a",
        "version": "1.0.0",
        "capabilities": {"streaming": True, "pushNotifications": False},
        "agents": [_build_agent_card(a, base_url) for a in agents],
        "authentication": {"schemes": []},
    }


@router.get("/agents/{agent_id}/card")
async def agent_card(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    """Individual agent card (A2A discovery)."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.skills))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    base_url = "http://localhost:8000"
    return _build_agent_card(agent, base_url)


@router.post("/agents/{agent_id}/a2a")
async def a2a_receive(agent_id: UUID, body: dict, db: AsyncSession = Depends(get_db)):
    """
    A2A JSON-RPC 2.0 endpoint — receives tasks from external agents.
    Supports: tasks/send
    """
    jsonrpc = body.get("jsonrpc", "2.0")
    method = body.get("method", "")
    params = body.get("params", {})
    request_id = body.get("id")

    def error_response(code: int, message: str):
        return {"jsonrpc": jsonrpc, "id": request_id, "error": {"code": code, "message": message}}

    if method != "tasks/send":
        return error_response(-32601, f"Method not found: {method}")

    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        return error_response(-32602, "Agent not found")

    # Extract text from A2A message format
    message = params.get("message", {})
    parts = message.get("parts", [])
    task_text = " ".join(p.get("text", "") for p in parts if p.get("type") == "text")
    if not task_text:
        task_text = str(params.get("message", ""))

    task_id = params.get("id", str(uuid4()))

    from ..workers.celery_app import celery_app
    celery_app.send_task(
        "app.workers.agent_tasks.run_agent_task",
        args=[str(agent_id), agent.name, "a2a_task", {"task": task_text}, agent.model],
    )

    return {
        "jsonrpc": jsonrpc,
        "id": request_id,
        "result": {
            "id": task_id,
            "status": {"state": "submitted"},
            "artifacts": [],
        },
    }
