"""Billing / usage endpoints — month-to-date spend and budget for the caller's org."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models_db import Organization
from ..tenancy import get_current_org
from ..billing import current_usage

router = APIRouter()


class BudgetUpdate(BaseModel):
    # None clears the cap (unlimited); a number sets the monthly USD cap.
    monthly_budget_usd: float | None = Field(default=None, ge=0)


@router.get("/billing/usage")
async def get_usage(db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    """Current-period spend, token total, and remaining budget for this workspace."""
    return await current_usage(org, db)


@router.put("/billing/budget")
async def set_budget(
    body: BudgetUpdate,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    """Set (or clear, with null) this workspace's monthly spend cap."""
    org.monthly_budget_usd = body.monthly_budget_usd
    await db.commit()
    await db.refresh(org)
    return await current_usage(org, db)
