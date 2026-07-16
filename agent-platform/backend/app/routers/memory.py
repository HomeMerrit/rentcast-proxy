from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..memory.manager import memory_manager

router = APIRouter()


@router.get("/{agent_id}/memories")
async def list_memories(agent_id: UUID):
    return await memory_manager.list_memories(str(agent_id))


@router.get("/{agent_id}/memories/search")
async def search_memories(agent_id: UUID, q: str, limit: int = 5):
    return await memory_manager.search(str(agent_id), q, limit=limit)


@router.post("/{agent_id}/memories", status_code=201)
async def add_memory(agent_id: UUID, body: dict):
    content = body.get("content", "")
    if not content:
        raise HTTPException(400, "content required")
    memory_id = await memory_manager.add(
        str(agent_id),
        content=content,
        task_type=body.get("task_type", "manual"),
    )
    return {"id": memory_id, "agent_id": str(agent_id), "content": content}


@router.delete("/{agent_id}/memories/{memory_id}", status_code=204)
async def delete_memory(agent_id: UUID, memory_id: str):
    deleted = await memory_manager.delete(memory_id)
    if not deleted:
        raise HTTPException(404, "Memory not found")
