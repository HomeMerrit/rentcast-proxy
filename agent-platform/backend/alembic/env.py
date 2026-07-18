"""Alembic environment — async engine, metadata from the app's models.

The URL comes from app.config.settings (single source of truth), and target
metadata is app.database.Base with every model imported so autogenerate sees the
full schema.
"""
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config import settings
from app.database import Base
import app.models_db  # noqa: F401  (registers every table on Base.metadata)

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

# NB: we deliberately do NOT call logging.config.fileConfig here. The app
# configures structured logging (app.observability) before running migrations at
# startup, and fileConfig would tear that down. Alembic uses whatever is set.

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        {"sqlalchemy.url": settings.database_url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio

    asyncio.run(run_migrations_online())
