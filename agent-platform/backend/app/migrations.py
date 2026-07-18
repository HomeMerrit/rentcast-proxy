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
from .config import settings

logger = logging.getLogger("agentos")

# Each entry: (table, column, column definition SQL)
_COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    ("agents", "avatar_url", "TEXT"),
    ("agents", "company_id", "UUID"),
    ("work_log", "cost_usd", "DOUBLE PRECISION DEFAULT 0.0"),
    # Multi-tenancy: every tenant-owned row gets an org_id (nullable so it can be
    # added to existing tables, then backfilled to the default org below).
    ("agents", "org_id", "UUID"),
    ("companies", "org_id", "UUID"),
    ("documents", "org_id", "UUID"),
    ("api_keys", "org_id", "UUID"),
    # Per-tenant monthly spend cap (NULL = unlimited). Backfilled below.
    ("organizations", "monthly_budget_usd", "DOUBLE PRECISION"),
]


async def run_migrations(engine: AsyncEngine) -> None:
    """Apply idempotent ADD COLUMN migrations, then the tenancy bootstrap."""
    async with engine.begin() as conn:
        for table, column, coldef in _COLUMN_MIGRATIONS:
            stmt = f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coldef}'
            try:
                await conn.execute(text(stmt))
                logger.info("migration ok: %s.%s", table, column)
            except Exception as exc:  # noqa: BLE001
                logger.warning("migration failed for %s.%s: %s", table, column, exc)

    await _tenancy_bootstrap(engine)


async def _tenancy_bootstrap(engine: AsyncEngine) -> None:
    """Ensure a default org exists, backfill pre-tenancy rows into it, and relax the
    global agents.name uniqueness to a per-org (org_id, name) constraint.

    All steps are idempotent and safe to run on every startup.
    """
    async with engine.begin() as conn:
        # 1) Default org (used when auth is off and to own pre-tenancy rows).
        try:
            await conn.execute(
                text(
                    "INSERT INTO organizations (id, name, slug, plan, created_at) "
                    "VALUES (:id, :name, 'default', 'pilot', now()) "
                    "ON CONFLICT (id) DO NOTHING"
                ),
                {"id": settings.default_org_id, "name": settings.default_org_name},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("tenancy: default org insert failed: %s", exc)

        # 2) Backfill any NULL org_id rows into the default org.
        for table in ("agents", "companies", "documents", "api_keys"):
            try:
                await conn.execute(
                    text(f"UPDATE {table} SET org_id = :id WHERE org_id IS NULL"),
                    {"id": settings.default_org_id},
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("tenancy: backfill %s failed: %s", table, exc)

        # 2b) Give the default org (the live pilot tenant) a spend cap if it has
        #     none yet. Targeted at the default org only, so a real signup org that
        #     an admin sets to NULL (unlimited) is never re-capped on restart. To
        #     make the default org unlimited, set a very high number, not NULL.
        try:
            await conn.execute(
                text(
                    "UPDATE organizations SET monthly_budget_usd = :budget "
                    "WHERE id = :id AND monthly_budget_usd IS NULL"
                ),
                {"budget": settings.default_monthly_budget_usd, "id": settings.default_org_id},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("tenancy: default-org budget backfill failed: %s", exc)

        # 3) Relax global name uniqueness -> per-org. Drop the old global unique
        #    constraint (name auto-assigned by Postgres) and ensure the composite one.
        for stmt in (
            "ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_name_key",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_agents_org_name ON agents (org_id, name)",
        ):
            try:
                await conn.execute(text(stmt))
            except Exception as exc:  # noqa: BLE001
                logger.warning("tenancy: constraint step failed (%s): %s", stmt, exc)

    logger.info("tenancy bootstrap complete (default org=%s)", settings.default_org_id)
