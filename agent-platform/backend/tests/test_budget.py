"""Per-tenant spend accounting + hard budget enforcement.

Builds a minimal app with the real billing router plus a stand-in "run" route
that mirrors how agents.run gates dispatch (assert_agent_in_org +
assert_within_budget) — without importing the celery/langgraph runtime. Proves:

  * /billing/usage sums month-to-date work_log cost + tokens for the caller org
  * usage is scoped per org (one tenant's spend never shows in another's)
  * once spend reaches the cap, dispatch is refused with 402
  * a NULL budget means unlimited (dispatch always allowed)
  * PUT /billing/budget sets / clears the cap
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import httpx
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.database import get_db
from app.models_db import Organization, Agent, WorkLog
from conftest import build_schema
from app.tenancy import get_current_org, assert_agent_in_org
from app.billing import assert_within_budget
from app.routers import auth as auth_router
from app.routers import billing as billing_router

DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with TestSession() as s:
        yield s


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router.router, prefix="/auth")
    app.include_router(billing_router.router)

    # Stand-in for agents.run: same gate order, no runtime import.
    @app.post("/run-test/{agent_id}")
    async def run(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
        await assert_agent_in_org(agent_id, org, db)
        await assert_within_budget(org, db)
        return {"dispatched": True}

    app.dependency_overrides[get_db] = _override_get_db
    return app


@pytest.fixture(autouse=True)
async def schema():
    await build_schema(test_engine)
    yield


@pytest.fixture
async def client():
    app = _make_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _signup(client, org_name, email):
    r = await client.post("/auth/signup", json={"org_name": org_name, "email": email})
    assert r.status_code == 201, r.text
    return r.json()


async def _seed_agent(org_id, name="Maya"):
    async with TestSession() as db:
        a = Agent(org_id=uuid.UUID(org_id), name=name, title="Rep", department="Sales", avatar_seed=name)
        db.add(a)
        await db.commit()
        await db.refresh(a)
        return str(a.id)


async def _seed_worklog(agent_id, cost, tokens):
    async with TestSession() as db:
        db.add(WorkLog(
            agent_id=uuid.UUID(agent_id),
            task_type="general",
            success=True,
            tokens_used=tokens,
            cost_usd=cost,
            started_at=datetime.now(timezone.utc),
        ))
        await db.commit()


async def _set_budget(org_id, budget):
    async with TestSession() as db:
        org = await db.get(Organization, uuid.UUID(org_id))
        org.monthly_budget_usd = budget
        await db.commit()


async def test_usage_reports_month_to_date(client):
    a = await _signup(client, "Acme", "a@acme.com")
    agent_id = await _seed_agent(a["org_id"])
    await _seed_worklog(agent_id, cost=1.0, tokens=100)
    await _seed_worklog(agent_id, cost=2.5, tokens=200)

    r = await client.get("/billing/usage", headers={"Authorization": f"Bearer {a['key']}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["spent_usd"] == 3.5
    assert body["tokens_used"] == 300
    # New org inherits the default cap; remaining reflects it.
    assert body["budget_usd"] is not None
    assert body["remaining_usd"] == round(body["budget_usd"] - 3.5, 6)
    assert body["over_budget"] is False


async def test_usage_scoped_to_org(client):
    a = await _signup(client, "Org A", "a@a.com")
    b = await _signup(client, "Org B", "b@b.com")
    agent_id = await _seed_agent(a["org_id"], "A-Maya")
    await _seed_worklog(agent_id, cost=4.0, tokens=400)

    rb = await client.get("/billing/usage", headers={"Authorization": f"Bearer {b['key']}"})
    assert rb.json()["spent_usd"] == 0.0
    assert rb.json()["tokens_used"] == 0


async def test_over_budget_blocks_dispatch(client):
    a = await _signup(client, "Acme", "a@acme.com")
    agent_id = await _seed_agent(a["org_id"])
    await _set_budget(a["org_id"], 1.0)
    await _seed_worklog(agent_id, cost=1.5, tokens=100)  # over the $1 cap

    h = {"Authorization": f"Bearer {a['key']}"}
    r = await client.post(f"/run-test/{agent_id}", headers=h)
    assert r.status_code == 402
    assert "budget" in r.json()["detail"].lower()


async def test_under_budget_allows_dispatch(client):
    a = await _signup(client, "Acme", "a@acme.com")
    agent_id = await _seed_agent(a["org_id"])
    await _set_budget(a["org_id"], 10.0)
    await _seed_worklog(agent_id, cost=1.5, tokens=100)  # well under cap

    h = {"Authorization": f"Bearer {a['key']}"}
    r = await client.post(f"/run-test/{agent_id}", headers=h)
    assert r.status_code == 200
    assert r.json()["dispatched"] is True


async def test_null_budget_is_unlimited(client):
    a = await _signup(client, "Acme", "a@acme.com")
    agent_id = await _seed_agent(a["org_id"])
    await _set_budget(a["org_id"], None)  # unlimited
    await _seed_worklog(agent_id, cost=9999.0, tokens=100)

    h = {"Authorization": f"Bearer {a['key']}"}
    r = await client.post(f"/run-test/{agent_id}", headers=h)
    assert r.status_code == 200


async def test_set_budget_endpoint(client):
    a = await _signup(client, "Acme", "a@acme.com")
    h = {"Authorization": f"Bearer {a['key']}"}
    r = await client.put("/billing/budget", json={"monthly_budget_usd": 200}, headers=h)
    assert r.status_code == 200
    assert r.json()["budget_usd"] == 200
    # Clearing to null = unlimited.
    r2 = await client.put("/billing/budget", json={"monthly_budget_usd": None}, headers=h)
    assert r2.json()["budget_usd"] is None
