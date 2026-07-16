from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from ..database import get_db
from ..models_db import AgentComm
from ..schemas import AgentCommOut, CommCreate

router = APIRouter()


@router.get("/human-inbox", response_model=list[AgentCommOut])
async def human_inbox(limit: int = 50, unread_only: bool = False, db: AsyncSession = Depends(get_db)):
    """Messages from agents directed to human operators (to_agent_id IS NULL, type=human_message or human_reply)."""
    q = select(AgentComm).where(
        AgentComm.to_agent_id == None,  # noqa: E711
        AgentComm.message_type.in_(["human_message", "human_reply"]),
    )
    if unread_only:
        q = q.where(AgentComm.read == False)  # noqa: E712
    q = q.order_by(AgentComm.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/human-inbox/count")
async def human_inbox_unread_count(db: AsyncSession = Depends(get_db)):
    """Unread count for notification badge."""
    result = await db.execute(
        select(func.count()).select_from(AgentComm).where(
            AgentComm.to_agent_id == None,  # noqa: E711
            AgentComm.message_type == "human_message",
            AgentComm.read == False,  # noqa: E712
        )
    )
    count = result.scalar_one()
    return {"unread": count}


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


@router.post("/{comm_id}/reply", response_model=AgentCommOut, status_code=201)
async def reply_to_agent(comm_id: UUID, body: dict, db: AsyncSession = Depends(get_db)):
    """Human replies to an agent message. Marks original as read and creates a reply comm."""
    result = await db.execute(select(AgentComm).where(AgentComm.id == comm_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Comm not found")

    # Mark original as read
    original.read = True

    # Create reply
    reply = AgentComm(
        from_agent_id=None,
        to_agent_id=original.from_agent_id,
        message=body.get("message", ""),
        message_type="human_reply",
        metadata_={"reply_to": str(comm_id), "from_human": True},
    )
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return reply
