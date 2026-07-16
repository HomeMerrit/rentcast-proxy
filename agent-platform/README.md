# AgentOS — AI Employee Platform

An Airtable HyperAgent-inspired platform: AI agents with LinkedIn-style profiles, running 24/7, communicating with each other and with humans, displaying real-time activity, and self-improving over time.

---

## What's Inside

| Layer | Tech |
|-------|------|
| **Orchestration** | LangGraph stateful ReAct graph |
| **Streaming** | AG-UI Protocol (SSE) |
| **Agent-to-Agent** | A2A Protocol (HTTP + JSON-RPC 2.0) |
| **Memory** | Mem0 + Qdrant (fastembed embeddings) |
| **Self-Improvement** | Reflexion (self-critique) + EvoAgentX (prompt evolution) |
| **Evaluation** | LLM-as-judge (Claude Haiku) + skill write-back |
| **Observability** | Langfuse tracing (optional) |
| **Code Execution** | E2B sandbox (subprocess fallback) |
| **Browser** | Playwright/browser-use (headless) |
| **Backend** | FastAPI + Celery + PostgreSQL |
| **Frontend** | Next.js 15 + Tailwind CSS |
| **Auth** | SHA-256 API keys (opt-in enforcement) |
| **Production** | Docker multi-stage builds + docker-compose |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                │
│  TeamDashboard → AgentCard → AgentProfile → WorkLogFeed │
│  HumanInbox   → SkillBadge → StatusDot                  │
│  AG-UI SSE hook (real-time streaming)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│  /agents  /stream  /comms  /work-log  /memory           │
│  /a2a     /evals   /auth                                │
│  RequestID middleware · CORS · API key auth             │
└───────┬──────────────────────┬──────────────────────────┘
        │ Celery tasks         │ Direct DB
┌───────▼──────┐   ┌──────────▼────────┐   ┌────────────┐
│ Celery Worker│   │   PostgreSQL 16    │   │ Qdrant     │
│  agent_tasks │   │ agents/work_log    │   │ (vectors)  │
│  LangGraph   │   │ messages/skills    │   │            │
│  ReAct loop  │   │ evals/api_keys     │   └────────────┘
└───────┬──────┘   └───────────────────┘
        │
┌───────▼─────────────────────────────────────────────────┐
│  LangGraph ReAct Graph                                   │
│  memory_retrieve → think → tools (max 5)                 │
│                 ↘ reflect → memory_store → complete      │
│                                                          │
│  Tools: web_search · run_code · browse_web              │
│         read_file  · send_a2a · notify_human            │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Docker** and **Docker Compose** (for local dev with infrastructure)
- **Anthropic API key** (`sk-ant-...`)
- Optional: E2B API key (sandboxed code execution), Langfuse keys (tracing)

---

## Quick Start (Development)

### 1. Clone and configure

```bash
git clone <your-repo>
cd agent-platform
cp backend/.env.example backend/.env
# Edit backend/.env — set ANTHROPIC_API_KEY at minimum
```

### 2. Start infrastructure

```bash
docker compose up -d
# Starts: PostgreSQL 16, Redis 7, Qdrant
```

### 3. Start the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Optional: install Playwright for browser tool
playwright install chromium

uvicorn app.main:app --reload --port 8000
```

### 4. Start Celery (background agent runner)

```bash
# In a second terminal (same venv, same backend/ dir)
celery -A app.workers.celery_app worker --loglevel=info
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Production Deployment

### 1. Set environment variables

```bash
cp .env.prod.example .env.prod   # or set directly
export ANTHROPIC_API_KEY=sk-ant-...
export POSTGRES_PASSWORD=<strong-password>
export REQUIRE_AUTH=true          # enable API key auth
export NEXT_PUBLIC_REQUIRE_AUTH=true
export NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

### 2. Build and launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Services started:
- `postgres` — PostgreSQL 16 (named volume)
- `redis` — Redis 7 with persistence
- `qdrant` — vector store
- `backend` — FastAPI on :8000
- `celery` — agent worker (concurrency=2)
- `celery-beat` — scheduled tasks
- `frontend` — Next.js standalone on :3000

### 3. (Optional) Reverse proxy with HTTPS

Point nginx/Caddy/Traefik at:
- `localhost:3000` → your domain (frontend)
- `localhost:8000` → `your-domain.com/api` (backend)

---

## Platform Guide

### Creating Your First Agent

```bash
curl -X POST http://localhost:8000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Assistant",
    "role": "Researcher",
    "persona": "A methodical researcher who finds accurate information",
    "tools": ["web_search", "run_code"],
    "model": "claude-sonnet-5-20251001"
  }'
```

Response includes the agent `id` — use it for all subsequent calls.

### Running a Task

Tasks are asynchronous. They run in Celery and stream events back via AG-UI SSE.

```bash
# Dispatch a task
curl -X POST http://localhost:8000/agents/{id}/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Summarize the latest AI research papers from this week"}'

# → returns: {"task_id": "celery-uuid"}
```

### Streaming Real-Time Output

```javascript
const es = new EventSource(`http://localhost:8000/stream/${agentId}`);

es.addEventListener("message", (e) => {
  const event = JSON.parse(e.data);
  // event types:
  // RUN_STARTED, RUN_FINISHED, RUN_ERROR
  // TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END
  // TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT
  // STATE_SNAPSHOT, STATE_DELTA
  // CUSTOM: { subtype: "REFLECTION" | "MEMORY_RETRIEVED" | "A2A_SENT" | "HUMAN_NOTIFIED" }
});
```

### Agent-to-Agent Communication (A2A)

Any agent can message another agent directly:

```bash
# Agent card (capabilities + endpoint info)
GET http://localhost:8000/agents/{id}/card

# Send a message to an agent
POST http://localhost:8000/agents/{targetId}/a2a
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "id": "1",
  "params": {
    "from_agent_id": "sourceAgentId",
    "message": "Please compile a weekly report"
  }
}
```

The `send_a2a` tool lets agents trigger this automatically during their ReAct loop.

### Human-in-the-Loop

Agents can surface questions to humans:

```bash
# Agent uses notify_human tool → message appears in inbox
GET http://localhost:8000/comms/inbox

# Reply to an agent's question
POST http://localhost:8000/comms/inbox/{messageId}/reply
{"content": "Yes, proceed with the analysis"}
```

### Memory

Each agent has semantic memory (Qdrant vectors, BGE-small embeddings):

```bash
# View agent's stored memories
GET http://localhost:8000/agents/{id}/memories

# Memory is automatic — retrieved before each task, stored after
```

Memories persist across sessions. Each Reflexion critique is also stored, so agents improve from past mistakes.

### Evaluations & Self-Improvement

After every task, Claude Haiku scores the output (0–100) and extracts skill deltas:

```bash
# View eval history
GET http://localhost:8000/agents/{id}/evals

# EvoAgentX triggers automatically when avg score < 60 over last 5 evals
# It rewrites the system prompt to address weaknesses
```

Skill proficiency is updated live and shown as badge levels in the UI.

---

## API Key Management (when `REQUIRE_AUTH=true`)

### Create a key

```bash
curl -X POST http://localhost:8000/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-integration"}'

# Response: {"id": "...", "name": "...", "key": "ak_xxxx", "active": true}
# ⚠️  The raw key is shown ONCE. Store it securely.
```

### Use a key

```bash
curl -H "Authorization: Bearer ak_xxxx" http://localhost:8000/agents
```

### List / revoke keys

```bash
# List
curl -H "Authorization: Bearer ak_xxxx" http://localhost:8000/auth/keys

# Revoke
curl -X DELETE -H "Authorization: Bearer ak_xxxx" http://localhost:8000/auth/keys/{id}
```

---

## Configuration Reference

All settings are read from environment variables (or `backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic key |
| `DATABASE_URL` | `postgresql+asyncpg://agentplatform:agentplatform@localhost:5432/agentplatform` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for Celery |
| `QDRANT_HOST` | `localhost` | Qdrant host |
| `QDRANT_PORT` | `6333` | Qdrant port |
| `REQUIRE_AUTH` | `false` | Enable API key enforcement |
| `ENABLE_RATE_LIMIT` | `false` | Enable per-IP rate limiting |
| `E2B_API_KEY` | *(empty)* | E2B sandbox (falls back to subprocess) |
| `LANGFUSE_PUBLIC_KEY` | *(empty)* | Langfuse tracing (disabled if empty) |
| `LANGFUSE_SECRET_KEY` | *(empty)* | Langfuse secret |
| `LANGFUSE_HOST` | `https://cloud.langfuse.com` | Langfuse endpoint |
| `ENVIRONMENT` | `development` | `development` or `production` |

Frontend (`NEXT_PUBLIC_*` variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL |
| `NEXT_PUBLIC_REQUIRE_AUTH` | `false` | Show login gate |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Team dashboard — all agents with status dots and live activity |
| `/agents/[id]` | Agent profile — skills, work log, memory feed, run task form |
| `/login` | API key login (only shown when `REQUIRE_AUTH=true`) |

**UI features:**
- **StatusDot** — green (active), yellow (thinking), gray (idle), red (error) — updates in real time via SSE
- **WorkLogFeed** — streaming task output with tool call details and reflection notes
- **SkillBadge** — proficiency level (0–100) per skill, auto-updated by LLM-as-judge
- **HumanInbox** — messages from agents awaiting human reply

---

## Agent Models

| Use Case | Model |
|----------|-------|
| Day-to-day tasks | `claude-sonnet-5-20251001` |
| Prompt evolution (EvoAgentX) | `claude-sonnet-5-20251001` |
| LLM-as-judge scoring | `claude-haiku-4-5-20251001` |
| Meta-agent / orchestration | `claude-opus-4-8` |

---

## ReAct Graph Flow

```
START
  ↓
memory_retrieve     ← fetches top-5 relevant memories from Qdrant
  ↓
think               ← Claude Sonnet 5: analyze task + memories, decide next action
  ↓
[conditional]
  ├─ call_tool      ← execute tool (max 5 tool calls per run)
  │    ↓ loop back to think
  └─ reflect        ← Reflexion: critique own output, store critique as memory
       ↓
memory_store        ← embed and upsert result + reflection to Qdrant
  ↓
complete            ← emit RUN_FINISHED event, trigger LLM-as-judge eval
  ↓
END
```

---

## Available Tools

| Tool | Description | Fallback |
|------|-------------|---------|
| `web_search` | DuckDuckGo search | — |
| `run_code` | Python execution in E2B sandbox | subprocess |
| `browse_web` | Headless Playwright browser | ImportError fallback |
| `read_file` | Read local files | — |
| `send_a2a` | Message another agent (A2A protocol) | — |
| `notify_human` | Send message to human inbox | — |

---

## Observability with Langfuse

Set both Langfuse keys to enable automatic tracing of every LLM call:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Traces appear in your Langfuse dashboard with:
- Full prompt/completion for every node in the graph
- Latency and token counts per call
- Evaluation scores linked to traces

---

## Health Check

```bash
curl http://localhost:8000/health
# {"status": "ok", "auth_required": false}
```

---

## Project Structure

```
agent-platform/
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph ReAct agent + AG-UI publisher
│   │   ├── eval/            # LLM-as-judge + EvoAgentX evolution
│   │   ├── memory/          # Mem0 + Qdrant memory manager
│   │   ├── routers/         # FastAPI routes (agents, stream, a2a, auth, evals…)
│   │   ├── tools/           # web_search, run_code, browse_web, a2a_tools
│   │   ├── workers/         # Celery app + agent_tasks
│   │   ├── auth.py          # API key hashing + FastAPI dependency
│   │   ├── config.py        # Pydantic settings
│   │   ├── database.py      # SQLAlchemy async engine
│   │   ├── main.py          # FastAPI app + middleware
│   │   ├── models_db.py     # SQLAlchemy ORM models
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js 15 App Router pages
│   │   ├── components/      # TeamDashboard, AgentCard, AgentProfile, etc.
│   │   ├── lib/             # api.ts, auth.ts, ag-ui.ts hooks
│   │   └── types/           # TypeScript types
│   ├── Dockerfile
│   └── next.config.ts
├── db/
│   ├── schema.sql           # Raw SQL schema
│   └── alembic/             # Migration support
├── docker-compose.yml       # Dev infrastructure (postgres, redis, qdrant)
└── docker-compose.prod.yml  # Full production stack
```

---

## Phases Built

| Phase | What was built |
|-------|---------------|
| 1 | Data models, FastAPI scaffold, Next.js 15 pages, mock data |
| 2 | LangGraph BaseAgent wired to AG-UI SSE streaming, Celery workers |
| 3 | Mem0 + Qdrant persistent memory, tool suite, memory UI |
| 4 | A2A protocol (agent-to-agent HTTP/SSE), human inbox, a2a tools |
| 5 | Langfuse tracing, LLM-as-judge evals, skill write-back, EvoAgentX evolution |
| 6 | API key auth, rate limit config, production Dockerfiles, docker-compose.prod.yml |
