import asyncio
import json
from uuid import UUID
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis
from ..config import settings

router = APIRouter()

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
async def stream_agent(agent_id: UUID):
    return StreamingResponse(
        event_generator(agent_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


async def fleet_event_generator():
    """Multiplex ALL agents' events into one stream via Redis pattern-subscribe."""
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.psubscribe("agent:*:events")
    try:
        yield f"data: {json.dumps({'type': 'CONNECTED', 'scope': 'fleet'})}\n\n"
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if msg and msg["type"] == "pmessage":
                yield f"data: {msg['data']}\n\n"
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.05)
    finally:
        await pubsub.punsubscribe("agent:*:events")
        await r.aclose()


@router.get("/fleet")
async def stream_fleet():
    return StreamingResponse(
        fleet_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
