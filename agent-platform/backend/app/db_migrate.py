"""Run Alembic migrations programmatically at startup.

`adopt_or_upgrade` is the single entry point the app boot calls. It makes the
transition to Alembic safe for a database that predates it:

  * fresh database (no tables)            -> `upgrade head` (baseline builds it all)
  * existing pre-Alembic database         -> `stamp head` (adopt in place, no DDL)
  * database already under Alembic control -> `upgrade head` (apply new revisions)

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

# A table that exists on any real pre-Alembic database — its presence without an
# alembic_version table means "existing DB, adopt it".
_SENTINEL_TABLE = "agents"


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

    def _tables(sync_conn) -> set[str]:
        return set(sa.inspect(sync_conn).get_table_names())

    async with engine.connect() as conn:
        names = await conn.run_sync(_tables)

    if "alembic_version" in names:
        action = "upgrade"          # already managed — apply any new revisions
    elif _SENTINEL_TABLE in names:
        action = "stamp"            # pre-Alembic DB — adopt at head without DDL
    else:
        action = "upgrade"          # fresh DB — baseline creates everything

    await asyncio.to_thread(_run_command, action)
    logger.info("db migrations: %s -> head", action)
    return action
