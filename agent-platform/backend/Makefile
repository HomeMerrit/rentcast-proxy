.PHONY: dev migrate worker beat

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	cd ../db && alembic upgrade head

worker:
	celery -A app.workers.celery_app worker --loglevel=info

beat:
	celery -A app.workers.celery_app beat --loglevel=info
