from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import agents, stream, comms, work_log, memory, a2a

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="AgentOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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

@app.get("/health")
async def health():
    return {"status": "ok"}
