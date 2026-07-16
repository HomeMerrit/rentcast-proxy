from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..database import get_db
from ..auth import generate_api_key, get_current_key
from ..models_db import APIKey

router = APIRouter()

class CreateKeyRequest(BaseModel):
    name: str

class KeyResponse(BaseModel):
    id: str
    name: str
    created_at: str
    last_used_at: str | None = None
    active: bool

@router.post("/keys", response_model=dict)
async def create_api_key(req: CreateKeyRequest, db: AsyncSession = Depends(get_db)):
    raw, key_hash = generate_api_key()
    key = APIKey(name=req.name, key_hash=key_hash)
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
async def list_api_keys(db: AsyncSession = Depends(get_db), _=Depends(get_current_key)):
    result = await db.execute(select(APIKey).where(APIKey.active == True))
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
async def delete_api_key(key_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_key)):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    key.active = False
    await db.commit()
    return {"ok": True}
