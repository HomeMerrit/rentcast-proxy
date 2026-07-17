"""Fleet-level statistics for the Command Center: aggregate KPIs, per-agent
rollups, recent cross-agent activity and daily time-series."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models_db import Agent, WorkLog, EvalResult

router = APIRouter()

ACTIVE = ["active", "thinking"]


def _rate(success, total):
    return round((success / total) * 100) if total else 0


@router.get("/stats/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    total_agents = await db.scalar(select(func.count(Agent.id))) or 0
    active = await db.scalar(select(func.count(Agent.id)).where(Agent.status.in_(ACTIVE))) or 0
    error = await db.scalar(select(func.count(Agent.id)).where(Agent.status == "error")) or 0
    tasks = await db.scalar(select(func.coalesce(func.sum(Agent.task_count), 0))) or 0
    success = await db.scalar(select(func.coalesce(func.sum(Agent.success_count), 0))) or 0
    cost = await db.scalar(select(func.coalesce(func.sum(WorkLog.cost_usd), 0.0))) or 0.0
    tokens = await db.scalar(select(func.coalesce(func.sum(WorkLog.tokens_used), 0))) or 0
    avg_eval = await db.scalar(select(func.avg(EvalResult.score)))

    dept_rows = (
        await db.execute(
            select(
                Agent.department,
                func.count(Agent.id),
                func.coalesce(func.sum(Agent.task_count), 0),
                func.coalesce(func.sum(Agent.success_count), 0),
            ).group_by(Agent.department).order_by(desc(func.count(Agent.id)))
        )
    ).all()
    departments = [
        {"department": d or "Unassigned", "agents": a, "tasks": int(t), "success": int(s)}
        for d, a, t, s in dept_rows
    ]

    return {
        "agents": total_agents,
        "active": active,
        "idle": max(0, total_agents - active - error),
        "error": error,
        "tasks": int(tasks),
        "success": int(success),
        "success_rate": _rate(int(success), int(tasks)),
        "total_cost_usd": round(float(cost), 4),
        "total_tokens": int(tokens),
        "avg_eval": round(float(avg_eval), 1) if avg_eval is not None else None,
        "departments": departments,
    }


@router.get("/stats/agents")
async def agent_stats(db: AsyncSession = Depends(get_db)):
    cost_sub = (
        select(
            WorkLog.agent_id.label("aid"),
            func.coalesce(func.sum(WorkLog.cost_usd), 0.0).label("cost"),
            func.coalesce(func.sum(WorkLog.tokens_used), 0).label("tokens"),
            func.max(WorkLog.finished_at).label("last_active"),
        ).group_by(WorkLog.agent_id).subquery()
    )
    eval_sub = (
        select(
            EvalResult.agent_id.label("aid"),
            func.avg(EvalResult.score).label("avg_eval"),
        ).group_by(EvalResult.agent_id).subquery()
    )
    rows = (
        await db.execute(
            select(
                Agent, cost_sub.c.cost, cost_sub.c.tokens, cost_sub.c.last_active, eval_sub.c.avg_eval
            )
            .outerjoin(cost_sub, cost_sub.c.aid == Agent.id)
            .outerjoin(eval_sub, eval_sub.c.aid == Agent.id)
            .order_by(desc(Agent.task_count))
        )
    ).all()

    out = []
    for agent, cost, tokens, last_active, avg_eval in rows:
        out.append({
            "id": str(agent.id),
            "name": agent.name,
            "title": agent.title,
            "department": agent.department,
            "status": agent.status,
            "avatar_seed": agent.avatar_seed,
            "avatar_url": agent.avatar_url,
            "current_task": agent.current_task,
            "task_count": agent.task_count,
            "success_count": agent.success_count,
            "success_rate": _rate(agent.success_count, agent.task_count),
            "cost_usd": round(float(cost or 0.0), 4),
            "tokens": int(tokens or 0),
            "avg_eval": round(float(avg_eval), 1) if avg_eval is not None else None,
            "last_active": last_active.isoformat() if last_active else None,
        })
    return out


@router.get("/stats/activity")
async def activity(limit: int = 40, db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(WorkLog, Agent.name, Agent.avatar_seed, Agent.avatar_url, Agent.department)
            .join(Agent, Agent.id == WorkLog.agent_id)
            .order_by(desc(WorkLog.started_at))
            .limit(min(limit, 100))
        )
    ).all()
    out = []
    for wl, name, seed, url, dept in rows:
        out.append({
            "id": str(wl.id),
            "agent_id": str(wl.agent_id),
            "agent_name": name,
            "avatar_seed": seed,
            "avatar_url": url,
            "department": dept,
            "task_type": wl.task_type,
            "success": wl.success,
            "cost_usd": round(float(wl.cost_usd or 0.0), 4),
            "tokens_used": wl.tokens_used,
            "duration_ms": wl.duration_ms,
            "result_preview": (wl.result or "")[:140],
            "started_at": wl.started_at.isoformat() if wl.started_at else None,
            "finished_at": wl.finished_at.isoformat() if wl.finished_at else None,
        })
    return out


@router.get("/stats/timeseries")
async def timeseries(days: int = 14, db: AsyncSession = Depends(get_db)):
    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", WorkLog.started_at).label("day")
    rows = (
        await db.execute(
            select(
                day,
                func.count().label("tasks"),
                func.coalesce(func.sum(WorkLog.cost_usd), 0.0).label("cost"),
                func.coalesce(func.sum(WorkLog.tokens_used), 0).label("tokens"),
                func.coalesce(func.sum(case((WorkLog.success, 1), else_=0)), 0).label("success"),
            )
            .where(WorkLog.started_at >= since)
            .group_by(day)
            .order_by(day)
        )
    ).all()
    # Build a dense series (fill gaps with zeros) so charts render evenly.
    by_day = {}
    for d, tasks, cost, tokens, success in rows:
        key = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
        by_day[key] = {"tasks": int(tasks), "cost": round(float(cost), 4),
                       "tokens": int(tokens), "success": int(success)}
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days - 1, -1, -1):
        dkey = (today - timedelta(days=i)).isoformat()
        v = by_day.get(dkey, {"tasks": 0, "cost": 0.0, "tokens": 0, "success": 0})
        series.append({"date": dkey, **v})
    return {"days": days, "series": series}
