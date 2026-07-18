from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from ..database import get_db
from ..models_db import AgentComm, Organization
from ..tenancy import get_current_org, assert_agent_in_org, org_agent_ids
from ..schemas import AgentCommOut, CommCreate

router = APIRouter()


@router.get("/human-inbox", response_model=list[AgentCommOut])
async def human_inbox(limit: int = 50, unread_only: bool = False, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    """Messages from this org's agents directed to human operators (to_agent_id IS NULL)."""
    ids = await org_agent_ids(org, db)
    if not ids:
        return []
    q = select(AgentComm).where(
        AgentComm.to_agent_id == None,  # noqa: E711
        AgentComm.message_type.in_(["human_message", "human_reply"]),
        AgentComm.from_agent_id.in_(ids),
    )
    if unread_only:
        q = q.where(AgentComm.read == False)  # noqa: E712
    q = q.order_by(AgentComm.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/human-inbox/count")
async def human_inbox_unread_count(db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    """Unread count for notification badge (scoped to this org's agents)."""
    ids = await org_agent_ids(org, db)
    if not ids:
        return {"unread": 0}
    result = await db.execute(
        select(func.count()).select_from(AgentComm).where(
            AgentComm.to_agent_id == None,  # noqa: E711
            AgentComm.message_type == "human_message",
            AgentComm.read == False,  # noqa: E712
            AgentComm.from_agent_id.in_(ids),
        )
    )
    count = result.scalar_one()
    return {"unread": count}


@router.get("/{agent_id}", response_model=list[AgentCommOut])
async def get_comms(agent_id: UUID, limit: int = 20, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    await assert_agent_in_org(agent_id, org, db)
    result = await db.execute(
        select(AgentComm)
        .where(or_(AgentComm.from_agent_id == agent_id, AgentComm.to_agent_id == agent_id))
        .order_by(AgentComm.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=AgentCommOut, status_code=201)
async def create_comm(body: CommCreate, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    # Both endpoints of a comm must belong to the caller's org.
    if body.from_agent_id is not None:
        await assert_agent_in_org(body.from_agent_id, org, db)
    if body.to_agent_id is not None:
        await assert_agent_in_org(body.to_agent_id, org, db)
    comm = AgentComm(**body.model_dump())
    db.add(comm)
    await db.commit()
    await db.refresh(comm)
    return comm


async def _load_comm_in_org(comm_id: UUID, org: Organization, db: AsyncSession) -> AgentComm:
    ids = await org_agent_ids(org, db)
    result = await db.execute(select(AgentComm).where(AgentComm.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(404, "Comm not found")
    # The comm must touch one of this org's agents.
    if comm.from_agent_id not in ids and comm.to_agent_id not in ids:
        raise HTTPException(404, "Comm not found")
    return comm


@router.patch("/{comm_id}/read")
async def mark_read(comm_id: UUID, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    comm = await _load_comm_in_org(comm_id, org, db)
    comm.read = True
    await db.commit()
    return {"ok": True}


@router.post("/{comm_id}/reply", response_model=AgentCommOut, status_code=201)
async def reply_to_agent(comm_id: UUID, body: dict, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    """Human replies to an agent message. Marks original as read and creates a reply comm."""
    original = await _load_comm_in_org(comm_id, org, db)

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
