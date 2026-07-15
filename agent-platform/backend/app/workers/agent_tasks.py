import asyncio
from uuid import UUID
from .celery_app import celery_app

def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

@celery_app.task(name="app.workers.agent_tasks.run_agent_task", bind=True, max_retries=3)
def run_agent_task(self, agent_id: str, task_type: str, task_input: dict):
    from ..agents.base_agent import BaseAgent
    agent = BaseAgent(agent_id=agent_id, agent_name="agent", task_type=task_type)
    try:
        result = run_async(agent.run(task_input))
        return result
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

@celery_app.task(name="app.workers.agent_tasks.health_check")
def health_check():
    return {"status": "ok"}

@celery_app.task(name="app.workers.agent_tasks.run_reflexion_eval")
def run_reflexion_eval():
    return {"status": "reflexion eval triggered"}
