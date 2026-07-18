from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import agents, stream, comms, work_log, memory, a2a, evals, skills, company, stats, billing
from .routers import auth as auth_router
from .database import engine
from .models_db import EvalResult, AgentConfig, APIKey, Company, Document, Organization, User  # noqa: F401
from .db_migrate import adopt_or_upgrade
from .config import settings
from .observability import (
    configure_logging, RequestIdMiddleware, add_exception_handler, init_sentry,
)
import logging

# Standardize logging + turn on error tracking before anything else runs.
configure_logging(level=settings.log_level, json_logs=settings.log_json)
init_sentry(settings.sentry_dsn, settings.environment)
logger = logging.getLogger("agentos")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bring the schema to head via Alembic: upgrade a fresh/managed DB, or adopt
    # (stamp) a pre-Alembic one in place. Replaces create_all + ad-hoc migrations.
    await adopt_or_upgrade(engine)
    # Startup warnings
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY is not set — agents will fail to run")
    if settings.require_auth:
        logger.info("Auth is ENABLED — all endpoints require a valid API key")
    else:
        logger.info("Auth is DISABLED — set REQUIRE_AUTH=true in production")
    # Rate limiter: one shared Redis client, only when enabled.
    app.state.limiter_redis = None
    if settings.enable_rate_limit:
        try:
            import redis.asyncio as aioredis
            app.state.limiter_redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            logger.info("Rate limiting ENABLED — %s req/min per key", settings.rate_limit_per_minute)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Rate limiter init failed (continuing without it): %s", exc)
    yield
    if app.state.limiter_redis is not None:
        await app.state.limiter_redis.aclose()

app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

# Catch-all error boundary: unhandled exceptions become a logged, correlated 500.
add_exception_handler(app)

# Per-key rate limiting (no-op unless ENABLE_RATE_LIMIT=true).
from .rate_limit import rate_limit_middleware  # noqa: E402
app.middleware("http")(rate_limit_middleware)

# Request correlation added LAST so it is the outermost user middleware: the id
# is minted before anything else runs and reaches the error boundary.
app.add_middleware(RequestIdMiddleware)

_cors_origins = ["http://localhost:3000", "http://localhost:3001"]
if settings.cors_origins:
    _cors_origins += [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Allow any Railway- or Vercel-hosted frontend (previews + production)
    allow_origin_regex=r"https://.*\.(up\.railway\.app|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/agents", tags=["agents"])
app.include_router(stream.router, prefix="/stream", tags=["stream"])
app.include_router(comms.router, prefix="/comms", tags=["comms"])
app.include_router(work_log.router, prefix="/work-log", tags=["work_log"])
app.include_router(memory.router, prefix="/agents", tags=["memory"])
app.include_router(a2a.router, tags=["a2a"])
app.include_router(evals.router, prefix="/agents", tags=["evals"])
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(skills.router, tags=["skills"])
app.include_router(company.router, tags=["company"])
app.include_router(stats.router, tags=["stats"])
app.include_router(billing.router, tags=["billing"])

@app.get("/health")
async def health():
    return {"status": "ok", "auth_required": settings.require_auth}
