import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from .celery_app import celery_app
from ..config import settings
from ..database import AsyncTaskSession


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _run_task_async(
    agent_id: str,
    agent_name: str,
    task_type: str,
    task_input: dict,
    model: str,
):
    from ..agents.base_agent import BaseAgent
    from ..agents.publisher import AgentEventPublisher
    from ..models_db import Agent, WorkLog

    started_at = datetime.now(timezone.utc)

    # Set agent status to active in DB before publishing
    async with AsyncTaskSession() as db:
        result = await db.execute(select(Agent).where(Agent.id == UUID(agent_id)))
        agent_row = result.scalar_one_or_none()
        if agent_row:
            agent_row.status = "active"
            agent_row.current_task = task_type
            await db.commit()

    async with AgentEventPublisher(agent_id, settings.redis_url) as publisher:
        await publisher.publish("RUN_STARTED", {"task_type": task_type, "agent_name": agent_name})
        await publisher.publish("STATE_SNAPSHOT", {"status": "active", "current_task": task_type})

        try:
            from ..memory.manager import memory_manager
            from ..tools.code_exec import execute_python
            from ..tools.browser import browse_web
            from ..tools.a2a_tools import create_a2a_tools

            a2a_tools = create_a2a_tools(agent_id, agent_name, publisher=publisher)
            agent_runner = BaseAgent(
                agent_id=agent_id,
                agent_name=agent_name,
                task_type=task_type,
                model=model,
                publisher=publisher,
                tools=[execute_python, browse_web] + a2a_tools,
                memory_manager=memory_manager,
            )
            result_data = await agent_runner.run(task_input)

            finished_at = datetime.now(timezone.utc)

            # Update agent and create WorkLog
            async with AsyncTaskSession() as db:
                result = await db.execute(select(Agent).where(Agent.id == UUID(agent_id)))
                agent_row = result.scalar_one_or_none()
                if agent_row:
                    agent_row.status = "idle"
                    agent_row.current_task = None
                    agent_row.task_count = (agent_row.task_count or 0) + 1
                    if result_data["success"]:
                        agent_row.success_count = (agent_row.success_count or 0) + 1

                work_log = WorkLog(
                    agent_id=UUID(agent_id),
                    task_type=task_type,
                    task_input=task_input,
                    result=result_data["result"],
                    reflection=result_data["reflection"],
                    success=result_data["success"],
                    tokens_used=result_data["tokens_used"],
                    duration_ms=result_data["duration_ms"],
                    started_at=started_at,
                    finished_at=finished_at,
                )
                db.add(work_log)
                await db.commit()

                # Dispatch async eval after successful commit
                run_eval_for_task.delay(
                    agent_id,
                    str(work_log.id),
                    task_type,
                    task_input,
                    result_data.get("result") or "",
                    result_data.get("reflection") or "",
                )

            await publisher.publish("STATE_SNAPSHOT", {"status": "idle", "current_task": None})
            await publisher.publish("RUN_FINISHED", {
                "result": result_data["result"],
                "tokens_used": result_data["tokens_used"],
                "duration_ms": result_data["duration_ms"],
            })

            return result_data

        except Exception as exc:
            async with AsyncTaskSession() as db:
                result = await db.execute(select(Agent).where(Agent.id == UUID(agent_id)))
                agent_row = result.scalar_one_or_none()
                if agent_row:
                    agent_row.status = "error"
                    agent_row.current_task = None
                    await db.commit()

            await publisher.publish("STATE_SNAPSHOT", {"status": "error", "current_task": None})
            await publisher.publish("RUN_ERROR", {"error": str(exc)})
            raise


@celery_app.task(name="app.workers.agent_tasks.run_agent_task", bind=True, max_retries=3)
def run_agent_task(
    self,
    agent_id: str,
    agent_name: str,
    task_type: str,
    task_input: dict,
    model: str = "claude-sonnet-5-20251001",
):
    try:
        return run_async(_run_task_async(agent_id, agent_name, task_type, task_input, model))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="app.workers.agent_tasks.health_check")
def health_check():
    return {"status": "ok"}


@celery_app.task(name="app.workers.agent_tasks.run_eval_for_task", ignore_result=True)
def run_eval_for_task(agent_id: str, work_log_id: str, task_type: str, task_input: dict, result: str, reflection: str):
    run_async(_eval_task_async(agent_id, work_log_id, task_type, task_input, result, reflection))


async def _eval_task_async(agent_id: str, work_log_id: str, task_type: str, task_input: dict, result: str, reflection: str):
    from ..eval.judge import evaluate_task
    from ..models_db import EvalResult, AgentSkill
    from datetime import datetime, timezone

    eval_data = await evaluate_task(task_type, task_input, result, reflection)
    score = max(0, min(100, int(eval_data.get("score", 50))))
    skill_updates = eval_data.get("skill_updates", {})

    async with AsyncTaskSession() as db:
        # Store eval result
        er = EvalResult(
            agent_id=agent_id,
            work_log_id=work_log_id if work_log_id else None,
            score=score,
            reasoning=eval_data.get("reasoning", ""),
            judge_model="claude-haiku-4-5-20251001",
            skill_updates=skill_updates,
        )
        db.add(er)

        # Apply skill proficiency updates
        for skill_name, delta in skill_updates.items():
            r = await db.execute(
                select(AgentSkill).where(
                    AgentSkill.agent_id == agent_id,
                    AgentSkill.skill == skill_name,
                )
            )
            skill = r.scalar_one_or_none()
            if skill:
                skill.proficiency = max(0, min(100, skill.proficiency + int(delta)))
                skill.times_used += 1
                skill.last_used = datetime.now(timezone.utc)
            else:
                db.add(AgentSkill(
                    agent_id=agent_id,
                    skill=skill_name,
                    proficiency=max(0, min(100, 50 + int(delta))),
                    times_used=1,
                    last_used=datetime.now(timezone.utc),
                ))
        await db.commit()

    # Check if evolution should be triggered
    await _maybe_trigger_evolution(agent_id)


# run_evolution_for_agent must be defined before _maybe_trigger_evolution references it
@celery_app.task(name="app.workers.agent_tasks.run_evolution_for_agent", ignore_result=True)
def run_evolution_for_agent(agent_id: str, agent_name: str, task_type: str = "general"):
    run_async(_evolve_agent_async(agent_id, agent_name, task_type))


async def _evolve_agent_async(agent_id: str, agent_name: str, task_type: str):
    from ..eval.evolution import evolve_agent_prompt
    from ..models_db import EvalResult, AgentConfig, WorkLog
    from ..agents.base_agent import SYSTEM_PROMPT
    from sqlalchemy import select, func, update
    from datetime import datetime, timezone

    async with AsyncTaskSession() as db:
        # Get avg score
        r = await db.execute(
            select(func.avg(EvalResult.score)).where(EvalResult.agent_id == agent_id)
        )
        avg_score = float(r.scalar_one() or 50)

        # Get current active prompt
        rc = await db.execute(
            select(AgentConfig).where(
                AgentConfig.agent_id == agent_id,
                AgentConfig.config_type == "system_prompt",
                AgentConfig.active == True,  # noqa: E712
            ).order_by(AgentConfig.generation.desc()).limit(1)
        )
        current_config = rc.scalar_one_or_none()
        current_prompt = current_config.value if current_config else SYSTEM_PROMPT
        current_gen = current_config.generation if current_config else 0

        # Get recent task history for context
        rw = await db.execute(
            select(WorkLog, EvalResult)
            .join(EvalResult, EvalResult.work_log_id == WorkLog.id, isouter=True)
            .where(WorkLog.agent_id == agent_id)
            .order_by(WorkLog.started_at.desc()).limit(10)
        )
        rows = rw.all()
        task_history = [
            {
                "task_type": row.WorkLog.task_type,
                "reflection": row.WorkLog.reflection or "",
                "score": row.EvalResult.score if row.EvalResult else None,
            }
            for row in rows
        ]

    # Generate evolved prompt (outside DB session to avoid long-held connections)
    new_prompt = await evolve_agent_prompt(
        agent_name=agent_name,
        task_type=task_type,
        current_prompt=current_prompt,
        task_history=task_history,
        avg_score=avg_score,
    )

    if new_prompt == current_prompt:
        return  # No improvement found

    async with AsyncTaskSession() as db:
        from sqlalchemy import update
        # Deactivate old configs
        await db.execute(
            update(AgentConfig).where(
                AgentConfig.agent_id == agent_id,
                AgentConfig.config_type == "system_prompt",
            ).values(active=False)
        )
        # Store new evolved prompt
        db.add(AgentConfig(
            agent_id=agent_id,
            config_type="system_prompt",
            value=new_prompt,
            generation=current_gen + 1,
            eval_score=avg_score,
            active=True,
        ))
        await db.commit()


async def _maybe_trigger_evolution(agent_id: str):
    """Trigger EvoAgentX evolution if last 5 eval scores average below 60."""
    from ..models_db import EvalResult, Agent
    async with AsyncTaskSession() as db:
        r = await db.execute(
            select(EvalResult.score).where(EvalResult.agent_id == agent_id)
            .order_by(EvalResult.created_at.desc()).limit(5)
        )
        scores = list(r.scalars().all())
        if len(scores) >= 5 and sum(scores) / len(scores) < 60:
            # Get agent name
            ra = await db.execute(select(Agent).where(Agent.id == agent_id))
            agent = ra.scalar_one_or_none()
            if agent:
                run_evolution_for_agent.delay(str(agent.id), agent.name, agent.title)


@celery_app.task(name="app.workers.agent_tasks.run_reflexion_eval")
def run_reflexion_eval():
    """Evaluate recent completed tasks that haven't been scored yet."""
    result = run_async(_reflexion_eval_async())
    return result


async def _reflexion_eval_async():
    from ..models_db import WorkLog, EvalResult
    from sqlalchemy import select, not_, exists
    from datetime import datetime, timezone, timedelta

    async with AsyncTaskSession() as db:
        # Find work_logs from last 2 hours with result and no EvalResult
        cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
        r = await db.execute(
            select(WorkLog).where(
                WorkLog.started_at >= cutoff,
                WorkLog.result != None,  # noqa: E711
                WorkLog.success == True,  # noqa: E712
                ~exists().where(EvalResult.work_log_id == WorkLog.id),
            ).limit(20)
        )
        unevaluated = r.scalars().all()

    for wl in unevaluated:
        run_eval_for_task.delay(
            str(wl.agent_id),
            str(wl.id),
            wl.task_type,
            wl.task_input or {},
            wl.result or "",
            wl.reflection or "",
        )

    return {"evaluated": len(unevaluated)}
