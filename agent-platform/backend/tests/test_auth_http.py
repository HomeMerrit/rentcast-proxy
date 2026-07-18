"""End-to-end auth boundary over HTTP.

Builds a minimal FastAPI app with the real auth router plus one org-guarded route
(mirroring how every business router is wired) and drives it with httpx. Proves,
through the actual FastAPI dependency stack with REQUIRE_AUTH=true:

  * signup mints an org + owner user + first API key
  * a guarded endpoint 401s without a key
  * org A's key can read org A's agent, but org B's key gets 404 (no cross-tenant read)
  * /auth/keys lists only the caller org's keys

We avoid importing the heavy agent-runtime routers by declaring a tiny stand-in
route that uses the same get_current_org + assert_agent_in_org dependencies.
"""
import os
import uuid
import pytest
import httpx
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.migrations import run_migrations
from app.models_db import Organization, Agent, APIKey, User
from app.tenancy import get_current_org, assert_agent_in_org
from app.routers import auth as auth_router
from app.routers import a2a as a2a_router

DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with TestSession() as s:
        yield s


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(auth_router.router, prefix="/auth")
    app.include_router(a2a_router.router)  # A2A card + tasks/send (root prefix)

    @app.get("/agents-test/{agent_id}")
    async def read_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
        agent = await assert_agent_in_org(agent_id, org, db)
        return {"id": str(agent.id), "name": agent.name}

    app.dependency_overrides[get_db] = _override_get_db
    return app


@pytest.fixture(autouse=True)
async def schema():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await run_migrations(test_engine)
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


async def test_signup_creates_org_user_key(client):
    body = await _signup(client, "Acme", "owner@acme.com")
    assert body["org_name"] == "Acme"
    assert body["key"].startswith("ak_")
    async with TestSession() as db:
        org = await db.get(Organization, uuid.UUID(body["org_id"]))
        user = await db.get(User, uuid.UUID(body["user_id"]))
        assert org is not None and user is not None
        assert user.org_id == org.id and user.role == "owner"


async def test_duplicate_email_rejected(client):
    await _signup(client, "Acme", "dup@acme.com")
    r = await client.post("/auth/signup", json={"org_name": "Acme2", "email": "dup@acme.com"})
    assert r.status_code == 409


async def test_guarded_route_requires_key(client):
    a = await _signup(client, "Acme", "a@acme.com")
    agent_id = await _seed_agent(a["org_id"])
    # No Authorization header -> 401
    r = await client.get(f"/agents-test/{agent_id}")
    assert r.status_code == 401


async def test_cross_tenant_read_blocked(client):
    a = await _signup(client, "Org A", "a@a.com")
    b = await _signup(client, "Org B", "b@b.com")
    agent_id = await _seed_agent(a["org_id"], "A-Maya")

    # Org A's key: 200
    ra = await client.get(f"/agents-test/{agent_id}", headers={"Authorization": f"Bearer {a['key']}"})
    assert ra.status_code == 200
    assert ra.json()["name"] == "A-Maya"

    # Org B's key: 404 (never leaks existence)
    rb = await client.get(f"/agents-test/{agent_id}", headers={"Authorization": f"Bearer {b['key']}"})
    assert rb.status_code == 404

    # Garbage key: 401
    rc = await client.get(f"/agents-test/{agent_id}", headers={"Authorization": "Bearer ak_nope"})
    assert rc.status_code == 401


async def test_keys_listing_scoped_to_org(client):
    a = await _signup(client, "Org A", "a@a.com")
    b = await _signup(client, "Org B", "b@b.com")
    ra = await client.get("/auth/keys", headers={"Authorization": f"Bearer {a['key']}"})
    assert ra.status_code == 200
    # Org A sees exactly its own one key, not B's.
    assert len(ra.json()) == 1


async def test_a2a_card_and_send_are_org_scoped(client):
    a = await _signup(client, "Org A", "a@a.com")
    b = await _signup(client, "Org B", "b@b.com")
    agent_id = await _seed_agent(a["org_id"], "A-Delegate")
    rpc = {"jsonrpc": "2.0", "id": "1", "method": "tasks/send",
           "params": {"message": {"parts": [{"type": "text", "text": "hi"}]}}}

    # No key -> 401 on both the card and tasks/send.
    assert (await client.get(f"/agents/{agent_id}/card")).status_code == 401
    assert (await client.post(f"/agents/{agent_id}/a2a", json=rpc)).status_code == 401

    # Org B (wrong tenant) -> 404, never triggers org A's agent.
    hb = {"Authorization": f"Bearer {b['key']}"}
    assert (await client.get(f"/agents/{agent_id}/card", headers=hb)).status_code == 404
    assert (await client.post(f"/agents/{agent_id}/a2a", json=rpc, headers=hb)).status_code == 404

    # Org A can read its own agent's card.
    ha = {"Authorization": f"Bearer {a['key']}"}
    rc = await client.get(f"/agents/{agent_id}/card", headers=ha)
    assert rc.status_code == 200
    assert rc.json()["name"] == "A-Delegate"
