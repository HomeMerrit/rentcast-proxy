import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from ..database import get_db
from ..auth import generate_api_key
from ..tenancy import get_current_org
from ..models_db import APIKey, Organization, User

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "org"


class SignupRequest(BaseModel):
    org_name: str
    email: str
    name: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email address")
        return v.lower()


class SignupResponse(BaseModel):
    org_id: str
    org_name: str
    user_id: str
    key: str  # shown only once
    key_id: str


@router.post("/signup", response_model=SignupResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new organization + owner user + first API key, atomically.

    This is the only unauthenticated write: it's how a brand-new tenant bootstraps.
    The raw key is returned once and never stored in plaintext.
    """
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    org = Organization(name=req.org_name.strip() or "Untitled", slug=_slugify(req.org_name), plan="pilot")
    db.add(org)
    await db.flush()  # assign org.id

    user = User(org_id=org.id, email=req.email, name=req.name, role="owner")
    db.add(user)

    raw, key_hash = generate_api_key()
    key = APIKey(name="Default key", key_hash=key_hash, org_id=org.id)
    db.add(key)

    await db.commit()
    await db.refresh(org)
    await db.refresh(user)
    await db.refresh(key)
    return SignupResponse(
        org_id=str(org.id), org_name=org.name, user_id=str(user.id), key=raw, key_id=key.id
    )


class CreateKeyRequest(BaseModel):
    name: str


class KeyResponse(BaseModel):
    id: str
    name: str
    created_at: str
    last_used_at: str | None = None
    active: bool


@router.post("/keys", response_model=dict)
async def create_api_key(
    req: CreateKeyRequest,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    raw, key_hash = generate_api_key()
    key = APIKey(name=req.name, key_hash=key_hash, org_id=org.id)
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return {
        "id": key.id,
        "name": key.name,
        "key": raw,  # shown only once
        "created_at": key.created_at.isoformat(),
        "active": key.active,
    }


@router.get("/keys", response_model=list[KeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    result = await db.execute(
        select(APIKey).where(APIKey.active == True, APIKey.org_id == org.id)  # noqa: E712
    )
    keys = result.scalars().all()
    return [
        KeyResponse(
            id=k.id,
            name=k.name,
            created_at=k.created_at.isoformat(),
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            active=k.active,
        )
        for k in keys
    ]


@router.delete("/keys/{key_id}")
async def delete_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.org_id == org.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    key.active = False
    await db.commit()
    return {"ok": True}
