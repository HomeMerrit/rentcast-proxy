import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .routers import agents, stream, comms, work_log, memory, a2a, evals, skills, company, stats
from .routers import auth as auth_router
from .database import engine, Base
from .models_db import EvalResult, AgentConfig, APIKey, Company, Document  # noqa: F401
from .migrations import run_migrations
from .config import settings
import logging

logger = logging.getLogger("agentos")

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Apply additive column migrations to existing tables (create_all won't).
    await run_migrations(engine)
    # Startup warnings
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY is not set — agents will fail to run")
    if settings.require_auth:
        logger.info("Auth is ENABLED — all endpoints require a valid API key")
    else:
        logger.info("Auth is DISABLED — set REQUIRE_AUTH=true in production")
    yield

app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

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

@app.get("/health")
async def health():
    return {"status": "ok", "auth_required": settings.require_auth}
