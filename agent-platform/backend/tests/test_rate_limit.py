"""Rate-limit middleware behaviour against real Redis.

Proves: within the window a key is allowed up to the limit then gets 429s; two
different keys have independent budgets; and when disabled the middleware is a
no-op.
"""
import os
import pytest
import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI

from app.config import settings
from app.rate_limit import rate_limit_middleware

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


def _make_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(rate_limit_middleware)

    @app.get("/ping")
    async def ping():
        return {"ok": True}

    return app


@pytest.fixture
async def redis_client():
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    await r.flushdb()
    yield r
    await r.flushdb()
    await r.aclose()


@pytest.fixture(autouse=True)
def _limit_settings():
    prev_enabled, prev_limit = settings.enable_rate_limit, settings.rate_limit_per_minute
    settings.enable_rate_limit = True
    settings.rate_limit_per_minute = 5
    yield
    settings.enable_rate_limit = prev_enabled
    settings.rate_limit_per_minute = prev_limit


async def _client(app):
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_allows_up_to_limit_then_429(redis_client):
    app = _make_app()
    app.state.limiter_redis = redis_client
    h = {"Authorization": "Bearer ak_one"}
    async with await _client(app) as c:
        codes = [(await c.get("/ping", headers=h)).status_code for _ in range(6)]
    assert codes[:5] == [200, 200, 200, 200, 200]
    assert codes[5] == 429


async def test_limits_are_per_key(redis_client):
    app = _make_app()
    app.state.limiter_redis = redis_client
    async with await _client(app) as c:
        for _ in range(5):
            await c.get("/ping", headers={"Authorization": "Bearer ak_a"})
        # key A is now exhausted...
        ra = await c.get("/ping", headers={"Authorization": "Bearer ak_a"})
        # ...but key B still has a full budget.
        rb = await c.get("/ping", headers={"Authorization": "Bearer ak_b"})
    assert ra.status_code == 429
    assert rb.status_code == 200


async def test_disabled_is_noop(redis_client):
    settings.enable_rate_limit = False
    app = _make_app()
    app.state.limiter_redis = redis_client
    async with await _client(app) as c:
        codes = [(await c.get("/ping", headers={"Authorization": "Bearer ak_x"})).status_code for _ in range(20)]
    assert all(code == 200 for code in codes)
