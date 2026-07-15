from celery import Celery
from celery.schedules import crontab
from ..config import settings

celery_app = Celery(
    "agent_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.agent_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "health-check-every-minute": {
            "task": "app.workers.agent_tasks.health_check",
            "schedule": crontab(minute="*/1"),
        },
        "reflexion-eval-every-hour": {
            "task": "app.workers.agent_tasks.run_reflexion_eval",
            "schedule": crontab(minute=0),
        },
    },
)
