"""Tenant-isolation guarantees at the data layer.

Proves the core Phase-1 invariant: two organizations coexist in one database and
neither can see or collide with the other's data. Runs against a real Postgres so
the composite-unique constraint, org_id backfill, and scoped queries are exercised
exactly as they will be in production.

A NullPool engine + function-scoped schema keeps every test on a single event loop
with fresh connections (avoids asyncpg cross-loop connection reuse under pytest).
"""
import os
import uuid
import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.models_db import Organization, Agent
from app.tenancy import assert_agent_in_org, org_agent_ids
from app.config import settings
from conftest import build_schema

DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


def _agent(org_id, name, dept="Sales"):
    return Agent(org_id=org_id, name=name, title="Rep", department=dept, avatar_seed=name)


@pytest.fixture(autouse=True)
async def schema():
    await build_schema(test_engine)
    yield


async def _new_org(db, name):
    org = Organization(name=name, slug=name.lower().replace(" ", "-"))
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


async def test_default_org_bootstrapped():
    async with TestSession() as db:
        org = await db.get(Organization, uuid.UUID(settings.default_org_id))
        assert org is not None
        assert org.name == settings.default_org_name


async def test_same_name_allowed_across_orgs():
    """Two different orgs may each have an agent named 'Maya' (per-org uniqueness)."""
    async with TestSession() as db:
        org_a = await _new_org(db, "Org A")
        org_b = await _new_org(db, "Org B")
        db.add(_agent(org_a.id, "Maya"))
        db.add(_agent(org_b.id, "Maya"))
        await db.commit()  # must not raise
        count = await db.scalar(select(func.count()).select_from(Agent).where(Agent.name == "Maya"))
        assert count == 2


async def test_duplicate_name_within_org_rejected():
    """The composite unique (org_id, name) still forbids duplicates inside one org."""
    async with TestSession() as db:
        org = await _new_org(db, "Org Dup")
        db.add(_agent(org.id, "Nova"))
        await db.commit()
        db.add(_agent(org.id, "Nova"))
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()


async def test_scoped_list_only_returns_own_org():
    async with TestSession() as db:
        org_a = await _new_org(db, "Scope A")
        org_b = await _new_org(db, "Scope B")
        db.add(_agent(org_a.id, "A-Ada"))
        db.add(_agent(org_a.id, "A-Ben"))
        db.add(_agent(org_b.id, "B-Cid"))
        await db.commit()

        a_rows = (await db.execute(select(Agent).where(Agent.org_id == org_a.id))).scalars().all()
        b_rows = (await db.execute(select(Agent).where(Agent.org_id == org_b.id))).scalars().all()
        a_names = {r.name for r in a_rows}
        assert a_names == {"A-Ada", "A-Ben"}
        assert "B-Cid" not in a_names
        assert {r.name for r in b_rows} == {"B-Cid"}


async def test_assert_agent_in_org_blocks_cross_tenant():
    async with TestSession() as db:
        org_a = await _new_org(db, "Cross A")
        org_b = await _new_org(db, "Cross B")
        a_agent = _agent(org_a.id, "Owned")
        db.add(a_agent)
        await db.commit()
        await db.refresh(a_agent)

        # Same org: returns the agent.
        got = await assert_agent_in_org(a_agent.id, org_a, db)
        assert got.id == a_agent.id

        # Cross org: 404, never leaks existence.
        with pytest.raises(HTTPException) as exc:
            await assert_agent_in_org(a_agent.id, org_b, db)
        assert exc.value.status_code == 404

        # org_agent_ids is scoped.
        ids_a = await org_agent_ids(org_a, db)
        ids_b = await org_agent_ids(org_b, db)
        assert a_agent.id in ids_a
        assert a_agent.id not in ids_b
