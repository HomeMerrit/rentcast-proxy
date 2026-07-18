import asyncio
import json
from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from ..config import settings
from ..database import get_db
from ..tenancy import org_from_token, assert_agent_in_org, org_agent_ids

router = APIRouter()

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


async def event_generator(agent_id: UUID):
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"agent:{agent_id}:events")

    try:
        yield f"data: {json.dumps({'type': 'CONNECTED', 'agent_id': str(agent_id)})}\n\n"
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if msg and msg["type"] == "message":
                yield f"data: {msg['data']}\n\n"
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.1)
    finally:
        await pubsub.unsubscribe(f"agent:{agent_id}:events")
        await r.aclose()


@router.get("/agents/{agent_id}")
async def stream_agent(agent_id: UUID, token: str | None = None, db: AsyncSession = Depends(get_db)):
    # EventSource can't set an Authorization header, so the key arrives as ?token=.
    org = await org_from_token(token, db)
    await assert_agent_in_org(agent_id, org, db)
    return StreamingResponse(event_generator(agent_id), media_type="text/event-stream", headers=_SSE_HEADERS)


def _agent_id_from_channel(channel: str) -> str | None:
    # channel looks like "agent:<uuid>:events"
    parts = channel.split(":")
    return parts[1] if len(parts) >= 3 else None


async def fleet_event_generator(allowed_ids: set[str]):
    """Multiplex this org's agents' events into one stream via Redis pattern-subscribe."""
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.psubscribe("agent:*:events")
    try:
        yield f"data: {json.dumps({'type': 'CONNECTED', 'scope': 'fleet'})}\n\n"
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if msg and msg["type"] == "pmessage":
                aid = _agent_id_from_channel(msg.get("channel", ""))
                if aid is None or aid in allowed_ids:
                    yield f"data: {msg['data']}\n\n"
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.05)
    finally:
        await pubsub.punsubscribe("agent:*:events")
        await r.aclose()


@router.get("/fleet")
async def stream_fleet(token: str | None = None, db: AsyncSession = Depends(get_db)):
    org = await org_from_token(token, db)
    allowed = {str(i) for i in await org_agent_ids(org, db)}
    return StreamingResponse(fleet_event_generator(allowed), media_type="text/event-stream", headers=_SSE_HEADERS)
