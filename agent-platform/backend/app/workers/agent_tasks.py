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


@celery_app.task(name="app.workers.agent_tasks.run_reflexion_eval")
def run_reflexion_eval():
    return {"status": "reflexion eval triggered"}
