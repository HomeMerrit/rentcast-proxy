"""Idempotent, additive schema migrations.

`Base.metadata.create_all` creates NEW tables but never adds columns to
EXISTING tables. Any new column on an already-existing table must be applied
here via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` (Postgres supports the
IF NOT EXISTS clause, so each statement is safe to run repeatedly).

This runs in the FastAPI lifespan AFTER create_all.
"""
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("agentos")

# Each entry: (table, column, column definition SQL)
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("agents", "avatar_url", "TEXT"),
    ("agents", "company_id", "UUID"),
    ("work_log", "cost_usd", "DOUBLE PRECISION DEFAULT 0.0"),
]


async def run_migrations(engine: AsyncEngine) -> None:
    """Apply idempotent ADD COLUMN migrations for new columns on existing tables."""
    async with engine.begin() as conn:
        for table, column, coldef in _COLUMN_MIGRATIONS:
            stmt = f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coldef}'
            try:
                await conn.execute(text(stmt))
                logger.info("migration ok: %s.%s", table, column)
            except Exception as exc:  # noqa: BLE001
                logger.warning("migration failed for %s.%s: %s", table, column, exc)
