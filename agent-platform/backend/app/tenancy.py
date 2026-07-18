"""Multi-tenancy: resolve the calling organization and scope resources to it.

Every business endpoint depends on `get_current_org`. With `REQUIRE_AUTH=false`
(pilots/dev) this transparently returns the single default org, so the app keeps
working single-tenant. With auth on, the org is derived from the API key, and no
request can read or write another org's data.
"""
import uuid
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .config import settings
from .auth import bearer, hash_key
from .models_db import Organization, APIKey, Agent


async def _default_org(db: AsyncSession) -> Organization:
    """Return the default org, creating it if the tenancy bootstrap hasn't yet."""
    oid = uuid.UUID(settings.default_org_id)
    org = await db.get(Organization, oid)
    if org is None:
        org = Organization(id=oid, name=settings.default_org_name, slug="default", plan="pilot")
        db.add(org)
        await db.commit()
        org = await db.get(Organization, oid)
    return org


async def _org_for_key(raw_key: str | None, db: AsyncSession) -> Organization:
    """Resolve an org from a raw API key. Raises 401 if the key is missing/invalid
    or 403 if it isn't attached to an org."""
    if not raw_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == hash_key(raw_key), APIKey.active == True)  # noqa: E712
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    if not api_key.org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key has no organization")
    await db.execute(
        sa_update(APIKey).where(APIKey.id == api_key.id).values(last_used_at=datetime.now(timezone.utc))
    )
    await db.commit()
    org = await db.get(Organization, api_key.org_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization not found")
    return org


async def get_current_org(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """FastAPI dependency. The tenant for this request.

    Auth off -> the default org (single-tenant pilot mode).
    Auth on  -> the org that owns the presented API key (401/403 otherwise).
    """
    if not settings.require_auth:
        return await _default_org(db)
    return await _org_for_key(credentials.credentials if credentials else None, db)


async def org_from_token(token: str | None, db: AsyncSession) -> Organization:
    """Resolve an org from a query-string token, for EventSource/SSE endpoints that
    cannot send an Authorization header. Falls back to the default org when auth is off."""
    if not settings.require_auth:
        return await _default_org(db)
    return await _org_for_key(token, db)


async def assert_agent_in_org(agent_id: uuid.UUID, org: Organization, db: AsyncSession) -> Agent:
    """Load an agent only if it belongs to `org`. Returns 404 (not 403) on a
    cross-tenant id so we never confirm the existence of another org's agents."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


async def org_agent_ids(org: Organization, db: AsyncSession) -> set[uuid.UUID]:
    """All agent ids owned by an org — used to scope fleet-wide queries and streams."""
    rows = await db.execute(select(Agent.id).where(Agent.org_id == org.id))
    return {r[0] for r in rows.all()}
