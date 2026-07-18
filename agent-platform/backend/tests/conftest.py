"""Test config. Set env BEFORE any app import so app.config picks up the test DB."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/agentos_test")
os.environ.setdefault("REQUIRE_AUTH", "true")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-not-used")

import sqlalchemy as sa  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncEngine  # noqa: E402


async def build_schema(engine: "AsyncEngine") -> None:
    """Reset the DB to a clean state and bring it to head via the real Alembic
    migration — so every test runs against exactly the schema production builds.
    """
    async with engine.begin() as conn:
        await conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        await conn.execute(sa.text("CREATE SCHEMA public"))
    from app.db_migrate import adopt_or_upgrade
    await adopt_or_upgrade(engine)
