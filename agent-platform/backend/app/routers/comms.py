from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from ..database import get_db
from ..models_db import AgentComm
from ..schemas import AgentCommOut, CommCreate

router = APIRouter()

@router.get("/{agent_id}", response_model=list[AgentCommOut])
async def get_comms(agent_id: UUID, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentComm)
        .where(or_(AgentComm.from_agent_id == agent_id, AgentComm.to_agent_id == agent_id))
        .order_by(AgentComm.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()

@router.post("/", response_model=AgentCommOut, status_code=201)
async def create_comm(body: CommCreate, db: AsyncSession = Depends(get_db)):
    comm = AgentComm(**body.model_dump())
    db.add(comm)
    await db.commit()
    await db.refresh(comm)
    return comm

@router.patch("/{comm_id}/read")
async def mark_read(comm_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentComm).where(AgentComm.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(404, "Comm not found")
    comm.read = True
    await db.commit()
    return {"ok": True}
