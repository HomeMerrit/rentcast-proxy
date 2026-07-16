import hashlib, secrets
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .config import settings

bearer = HTTPBearer(auto_error=False)

def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def generate_api_key() -> tuple[str, str]:
    """Returns (raw_key, hash). Store only hash."""
    raw = "ak_" + secrets.token_urlsafe(32)
    return raw, hash_key(raw)

async def get_current_key(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency. No-op if settings.require_auth is False."""
    if not settings.require_auth:
        return None
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    from .models_db import APIKey
    from sqlalchemy import update as sa_update
    from datetime import datetime, timezone
    key_hash = hash_key(credentials.credentials)
    result = await db.execute(select(APIKey).where(APIKey.key_hash == key_hash, APIKey.active == True))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    await db.execute(
        sa_update(APIKey).where(APIKey.id == api_key.id).values(last_used_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return api_key
