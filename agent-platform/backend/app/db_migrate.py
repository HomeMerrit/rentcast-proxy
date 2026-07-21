"""Run Alembic migrations programmatically at startup.

`adopt_or_upgrade` is the single entry point the app boot calls. It makes the
transition to Alembic safe for a database in any state:

  * fresh database (no tables)             -> `upgrade head` (baseline builds it all)
  * complete pre-Alembic database          -> `stamp head` (adopt in place, no DDL)
  * database already under Alembic control -> `upgrade head` (apply new revisions)
  * incomplete schema (partial/legacy)     -> quarantine existing tables by rename,
                                              then `upgrade head` to build fresh

The last case is the safety net: stamping a database that is missing tables
would adopt the hole as "head" forever and 500 on every request that touches
the missing relation. Never stamp unless every model table actually exists;
never drop data — quarantined tables keep their rows for manual recovery.

Detection is done async against the app engine; the Alembic command itself runs
in a worker thread because env.py drives an async engine via asyncio.run(), which
cannot nest inside the already-running lifespan event loop.
"""
import asyncio
import logging
import os

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("agentos")

_ALEMBIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic")
_ALEMBIC_INI = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini")


def _config():
    from alembic.config import Config

    cfg = Config(_ALEMBIC_INI)
    cfg.set_main_option("script_location", _ALEMBIC_DIR)
    return cfg


def _run_command(action: str) -> None:
    """Runs in a worker thread (no running event loop)."""
    from alembic import command

    cfg = _config()
    if action == "stamp":
        command.stamp(cfg, "head")
    else:
        command.upgrade(cfg, "head")


async def adopt_or_upgrade(engine: AsyncEngine) -> str:
    """Bring the database to head. Returns the action taken (for logging/tests)."""
    from .database import Base
    from . import models_db  # noqa: F401  (registers every table on Base.metadata)

    app_tables = set(Base.metadata.tables)

    def _tables(sync_conn) -> set[str]:
        return set(sa.inspect(sync_conn).get_table_names())

    async with engine.connect() as conn:
        names = await conn.run_sync(_tables)

    present = names & app_tables
    complete = app_tables <= names

    if complete:
        # Every model table exists: managed DBs upgrade, pre-Alembic DBs are
        # adopted in place with no DDL.
        action = "upgrade" if "alembic_version" in names else "stamp"
    elif not present:
        action = "upgrade"  # fresh database — the baseline creates everything
    else:
        # Partial schema: a legacy DB missing newer tables, or the residue of an
        # interrupted build (possibly already mis-stamped). Rename what exists
        # out of the way — rows preserved for manual recovery — and build fresh.
        action = "rebuild"
        missing = sorted(app_tables - names)
        logger.warning(
            "db migrations: incomplete schema (missing: %s) — quarantining %d existing table(s) and rebuilding",
            ", ".join(missing), len(present),
        )
        async with engine.begin() as conn:
            all_indexes = {
                r[0] for r in await conn.execute(sa.text(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
                ))
            }
            for t in sorted(present):
                target = f"{t}__quarantined"
                n = 1
                while target in names:
                    n += 1
                    target = f"{t}__quarantined{n}"
                names.add(target)
                await conn.execute(sa.text(f'ALTER TABLE "{t}" RENAME TO "{target}"'))
                # Index names are schema-global and survive a table rename —
                # move them aside too or the rebuild's create_index collides.
                idx_rows = await conn.execute(sa.text(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = :t"
                ), {"t": target})
                for (idx,) in idx_rows:
                    new_idx = f"{idx}__quarantined"
                    n = 1
                    while new_idx in all_indexes:
                        n += 1
                        new_idx = f"{idx}__quarantined{n}"
                    all_indexes.add(new_idx)
                    await conn.execute(sa.text(f'ALTER INDEX "{idx}" RENAME TO "{new_idx}"'))
                logger.warning("db migrations: quarantined %s -> %s", t, target)
            if "alembic_version" in names:
                # A version stamp over a broken schema is meaningless — clear it
                # so the baseline upgrade starts from scratch.
                await conn.execute(sa.text("DROP TABLE alembic_version"))

    await asyncio.to_thread(_run_command, action)
    logger.info("db migrations: %s -> head", action)
    return action
