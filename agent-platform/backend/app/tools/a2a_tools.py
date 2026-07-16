"""A2A inter-agent communication and human notification tools."""
from __future__ import annotations
from datetime import datetime, timezone
from langchain_core.tools import tool
from typing import Optional
from ..agents.publisher import AgentEventPublisher


def create_a2a_tools(agent_id: str, agent_name: str, publisher: Optional[AgentEventPublisher] = None) -> list:
    """Create A2A tools with agent context bound via closure."""

    @tool
    async def send_to_agent(target_agent_name: str, task: str) -> str:
        """
        Send a task or message to another agent by name.
        Use this to delegate subtasks, ask for specialized help, or collaborate.
        The agent will process the task asynchronously.
        """
        from ..database import AsyncTaskSession
        from ..models_db import Agent, AgentComm
        from ..workers.celery_app import celery_app
        from sqlalchemy import select

        async with AsyncTaskSession() as db:
            result = await db.execute(select(Agent).where(Agent.name == target_agent_name))
            target = result.scalar_one_or_none()
            if not target:
                # Try partial match
                result = await db.execute(select(Agent).where(Agent.name.ilike(f"%{target_agent_name}%")))
                target = result.scalar_one_or_none()
            if not target:
                return f"Agent '{target_agent_name}' not found. Available agents can be listed via the API."

            comm = AgentComm(
                from_agent_id=agent_id,
                to_agent_id=str(target.id),
                message=task,
                message_type="task",
                metadata_={"from_agent_name": agent_name},
            )
            db.add(comm)
            await db.commit()

            # Trigger the target agent's Celery task
            celery_app.send_task(
                "app.workers.agent_tasks.run_agent_task",
                args=[str(target.id), target.name, "a2a_task", {"task": task, "from_agent": agent_name}, target.model],
            )

        if publisher:
            await publisher.publish("CUSTOM", {
                "subtype": "A2A_SENT",
                "to_agent": target_agent_name,
                "task_preview": task[:120],
            })

        return f"Task sent to {target_agent_name}. They will process it and the result will appear in the comms feed."

    @tool
    async def notify_human(message: str, urgency: str = "normal") -> str:
        """
        Send a message to human operators when you need help, approval, or want to share important information.
        Use for: decisions requiring human judgment, errors you can't resolve, important findings to share.
        urgency: 'normal' or 'high'
        """
        from ..database import AsyncTaskSession
        from ..models_db import AgentComm

        async with AsyncTaskSession() as db:
            comm = AgentComm(
                from_agent_id=agent_id,
                to_agent_id=None,
                message=message,
                message_type="human_message",
                metadata_={"from_agent_name": agent_name, "urgency": urgency},
            )
            db.add(comm)
            await db.commit()

        if publisher:
            await publisher.publish("CUSTOM", {
                "subtype": "HUMAN_NOTIFIED",
                "message_preview": message[:120],
                "urgency": urgency,
            })

        return f"Message sent to human operators: '{message[:80]}...'. They will reply via the inbox."

    return [send_to_agent, notify_human]
