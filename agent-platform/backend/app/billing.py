"""Per-tenant spend accounting and hard budget enforcement.

Every completed task writes `cost_usd` and `tokens_used` to `work_log`. We sum
those per organization over the current calendar month (UTC) and refuse to
dispatch new work once an org has reached its `monthly_budget_usd`. A NULL budget
means unlimited; the `enforce_budget` kill-switch disables blocking globally
while leaving accounting intact so `/billing/usage` always reports real numbers.

Budget is a safety control at the *dispatch* boundary: it is checked before a
task is queued, not mid-run. In-run agent-to-agent delegation is bounded by the
parent task, which was itself budget-checked when it was dispatched.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models_db import WorkLog, Agent, Organization
from .config import settings


def period_start(now: datetime | None = None) -> datetime:
    """First instant of the current calendar month, UTC."""
    now = now or datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def current_usage(org: Organization, db: AsyncSession) -> dict:
    """Month-to-date spend + token totals for `org`, plus its budget headroom."""
    start = period_start()
    stmt = (
        select(
            func.coalesce(func.sum(WorkLog.cost_usd), 0.0),
            func.coalesce(func.sum(WorkLog.tokens_used), 0),
        )
        .select_from(WorkLog)
        .join(Agent, WorkLog.agent_id == Agent.id)
        .where(Agent.org_id == org.id, WorkLog.started_at >= start)
    )
    spent, tokens = (await db.execute(stmt)).one()
    spent = round(float(spent or 0.0), 6)
    budget = org.monthly_budget_usd
    return {
        "period_start": start.isoformat(),
        "budget_usd": budget,
        "spent_usd": spent,
        "remaining_usd": (round(budget - spent, 6) if budget is not None else None),
        "tokens_used": int(tokens or 0),
        "over_budget": (budget is not None and spent >= budget),
    }


async def assert_within_budget(org: Organization, db: AsyncSession) -> None:
    """Raise 402 if dispatching more work would exceed the org's monthly cap.

    No-op when enforcement is disabled or the org has no budget (NULL = unlimited).
    """
    if not settings.enforce_budget:
        return
    budget = org.monthly_budget_usd
    if budget is None:
        return
    usage = await current_usage(org, db)
    if usage["over_budget"]:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Monthly budget of ${budget:.2f} reached "
                f"(${usage['spent_usd']:.2f} spent this period). "
                f"Raise the workspace budget to dispatch more work."
            ),
        )
