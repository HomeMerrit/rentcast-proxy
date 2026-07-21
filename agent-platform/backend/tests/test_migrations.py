"""Alembic migration path — the mechanism that builds/adopts the production DB.

Proves the three startup scenarios adopt_or_upgrade must handle safely, plus a
drift guard so the baseline can never silently fall out of sync with the models:

  * fresh DB              -> `upgrade`: every table + alembic_version + default org
  * existing pre-Alembic  -> `stamp`:  adopt in place, no DDL, data preserved
  * already managed        -> `upgrade` again is a no-op (idempotent)
  * incomplete schema     -> `rebuild`: quarantine by rename (rows kept), build fresh
  * models == migrations  -> `alembic check` reports no pending changes
"""
import os
import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.db_migrate import adopt_or_upgrade, _config
from app.config import settings

DB_URL = os.environ["DATABASE_URL"]
test_engine = create_async_engine(DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

EXPECTED_TABLES = {
    "organizations", "users", "agents", "agent_skills", "work_log", "agent_comms",
    "agent_sessions", "eval_results", "agent_configs", "api_keys", "companies",
    "documents", "alembic_version",
}


async def _drop_all():
    async with test_engine.begin() as conn:
        await conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        await conn.execute(sa.text("CREATE SCHEMA public"))


async def _tables() -> set[str]:
    async with test_engine.connect() as conn:
        return await conn.run_sync(lambda c: set(sa.inspect(c).get_table_names()))


async def test_fresh_db_upgrades_and_seeds_default_org():
    await _drop_all()
    action = await adopt_or_upgrade(test_engine)
    assert action == "upgrade"
    assert EXPECTED_TABLES.issubset(await _tables())
    # default org present with its configured budget
    async with TestSession() as db:
        row = (await db.execute(sa.text(
            "SELECT name, monthly_budget_usd FROM organizations WHERE id = :id"
        ), {"id": settings.default_org_id})).first()
    assert row is not None
    assert row[0] == settings.default_org_name
    assert float(row[1]) == settings.default_monthly_budget_usd


async def test_existing_predates_alembic_is_stamped_not_rebuilt():
    """A DB with tables but no alembic_version is adopted in place, data intact."""
    await _drop_all()
    # Simulate the pre-Alembic world: build tables the old way and add a row.
    from app.database import Base
    import app.models_db  # noqa: F401
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    marker = str(uuid.uuid4())
    async with test_engine.begin() as conn:
        await conn.execute(sa.text(
            "INSERT INTO organizations (id, name, plan, created_at) "
            "VALUES (:id, 'Preexisting', 'pilot', now())"
        ), {"id": marker})

    action = await adopt_or_upgrade(test_engine)
    assert action == "stamp"
    tables = await _tables()
    assert "alembic_version" in tables
    # The pre-existing row must still be there (no rebuild/wipe).
    async with TestSession() as db:
        found = (await db.execute(sa.text(
            "SELECT name FROM organizations WHERE id = :id"
        ), {"id": marker})).scalar_one_or_none()
    assert found == "Preexisting"


async def test_incomplete_schema_is_quarantined_and_rebuilt():
    """A DB missing model tables (legacy shape or an interrupted build) must
    never be stamped: what exists is renamed aside — rows intact — and the
    baseline builds a complete schema."""
    await _drop_all()
    from app.database import Base
    import app.models_db  # noqa: F401
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    marker = str(uuid.uuid4())
    async with test_engine.begin() as conn:
        await conn.execute(sa.text(
            "INSERT INTO organizations (id, name, plan, created_at) "
            "VALUES (:id, 'LegacyOrg', 'pilot', now())"
        ), {"id": marker})
        # Simulate the pre-tenancy production shape: core tables present, the
        # newer org/user tables gone, no alembic_version.
        await conn.execute(sa.text("ALTER TABLE organizations RENAME TO organizations__old"))
        await conn.execute(sa.text('DROP TABLE IF EXISTS users CASCADE'))

    action = await adopt_or_upgrade(test_engine)
    assert action == "rebuild"
    tables = await _tables()
    assert EXPECTED_TABLES.issubset(tables)
    # existing tables were renamed aside, not dropped — the legacy row survives
    assert "agents__quarantined" in tables
    async with TestSession() as db:
        found = (await db.execute(sa.text(
            "SELECT name FROM organizations__old WHERE id = :id"
        ), {"id": marker})).scalar_one_or_none()
    assert found == "LegacyOrg"
    # and the fresh schema is genuinely usable: default org seeded
    async with TestSession() as db:
        seeded = (await db.execute(sa.text(
            "SELECT name FROM organizations WHERE id = :id"
        ), {"id": settings.default_org_id})).scalar_one_or_none()
    assert seeded == settings.default_org_name


async def test_idempotent_second_run_is_noop():
    await _drop_all()
    first = await adopt_or_upgrade(test_engine)
    second = await adopt_or_upgrade(test_engine)
    assert first == "upgrade"
    assert second == "upgrade"  # alembic_version now exists -> upgrade (already head)
    assert EXPECTED_TABLES.issubset(await _tables())


async def test_models_match_migration_no_drift():
    """`alembic check` must report no pending autogenerated changes."""
    await _drop_all()
    await adopt_or_upgrade(test_engine)

    import asyncio
    from alembic import command
    from alembic.util.exc import AutogenerateDiffsDetected

    def _check():
        command.check(_config())

    try:
        await asyncio.to_thread(_check)
    except AutogenerateDiffsDetected as exc:  # pragma: no cover - failure path
        pytest.fail(f"models have drifted from the baseline migration:\n{exc}")
