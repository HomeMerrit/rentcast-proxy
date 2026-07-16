import json
from datetime import datetime, timezone
import redis.asyncio as aioredis


class AgentEventPublisher:
    def __init__(self, agent_id: str, redis_url: str):
        self.agent_id = agent_id
        self.channel = f"agent:{agent_id}:events"
        self.redis_url = redis_url
        self._r: aioredis.Redis | None = None

    async def __aenter__(self):
        self._r = aioredis.from_url(self.redis_url, decode_responses=True)
        return self

    async def __aexit__(self, *_):
        if self._r:
            await self._r.aclose()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def publish(self, event_type: str, data: dict):
        if not self._r:
            return
        event = json.dumps({
            "type": event_type,
            "agent_id": self.agent_id,
            "data": data,
            "timestamp": self._now(),
        })
        await self._r.publish(self.channel, event)
