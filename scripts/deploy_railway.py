#!/usr/bin/env python3
"""
AgentOS -> Railway full-stack deployment.

Runs from GitHub Actions where backboard.railway.app is reachable.
Creates: project, postgres, redis, qdrant, backend, celery, celery-beat, frontend.
"""
import os, sys, json, time, subprocess
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
API = "https://backboard.railway.app/graphql/v2"
WORKSPACE = os.environ.get("GITHUB_WORKSPACE", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLATFORM = os.path.join(WORKSPACE, "agent-platform")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def gql(query, variables=None, soft=False):
    payload = {"query": query, "variables": variables or {}}
    r = requests.post(API, json=payload, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    if "errors" in data:
        msg = json.dumps(data["errors"], indent=2)
        if soft:
            print(f"  [warn] GraphQL: {msg[:200]}")
            return {}
        raise RuntimeError(f"GraphQL error:\n{msg}")
    return data.get("data", {})


def cli(cmd, cwd=None, check=True):
    print(f"\n  $ {cmd}", flush=True)
    env = {**os.environ, "RAILWAY_TOKEN": TOKEN}
    r = subprocess.run(cmd, shell=True, text=True, cwd=cwd, env=env)
    if check and r.returncode != 0:
        raise RuntimeError(f"Command failed (exit {r.returncode}): {cmd}")
    return r.returncode == 0


def step(n, msg):
    print(f"\n{'='*60}\n  [{n}] {msg}\n{'='*60}", flush=True)


# ── 1. Verify auth ─────────────────────────────────────────────
step(1, "Verify Railway token")
me = gql("{ me { id email name } }")
print(f"  Authenticated: {me['me'].get('name') or me['me']['email']}")

# ── 2. Create project ──────────────────────────────────────────
step(2, "Create Railway project")
proj = gql("""
mutation($name: String!) {
  projectCreate(input: { name: $name }) {
    id
    environments { edges { node { id name } } }
  }
}
""", {"name": "agentos-platform"})

PROJECT_ID = proj["projectCreate"]["id"]
ENV_ID = proj["projectCreate"]["environments"]["edges"][0]["node"]["id"]
print(f"  Project ID:     {PROJECT_ID}")
print(f"  Environment ID: {ENV_ID}")
os.environ["RAILWAY_PROJECT_ID"] = PROJECT_ID
os.environ["RAILWAY_ENVIRONMENT_ID"] = ENV_ID

# ── 3. Create Postgres ─────────────────────────────────────────
step(3, "Create Postgres database")
PG_ID = None

# Try plugin API (older Railway)
pg = gql("""
mutation($input: PluginCreateInput!) {
  pluginCreate(input: $input) { id name }
}
""", {"input": {"projectId": PROJECT_ID, "name": "postgres", "plugin": "POSTGRESQL"}}, soft=True)
PG_ID = (pg.get("pluginCreate") or {}).get("id")

if not PG_ID:
    # Try newer database API
    pg2 = gql("""
mutation($input: PostgresCreateInput!) {
  postgresCreate(input: $input) { id }
}
""", {"input": {"projectId": PROJECT_ID, "name": "postgres", "defaultDatabaseName": "railway"}}, soft=True)
    PG_ID = (pg2.get("postgresCreate") or {}).get("id")

if not PG_ID:
    # CLI fallback
    print("  Falling back to Railway CLI for Postgres...")
    cli("railway add --database postgresql --yes 2>/dev/null || "
        "railway add --plugin postgresql --yes 2>/dev/null || "
        "railway database add postgresql 2>/dev/null || true", check=False)
    print("  Postgres created via CLI")
else:
    print(f"  Postgres ID: {PG_ID}")

print("  Waiting 8s for database to initialise...")
time.sleep(8)

# ── 4. Create Redis ────────────────────────────────────────────
step(4, "Create Redis database")
RD_ID = None

rd = gql("""
mutation($input: PluginCreateInput!) {
  pluginCreate(input: $input) { id name }
}
""", {"input": {"projectId": PROJECT_ID, "name": "redis", "plugin": "REDIS"}}, soft=True)
RD_ID = (rd.get("pluginCreate") or {}).get("id")

if not RD_ID:
    rd2 = gql("""
mutation($input: RedisCreateInput!) {
  redisCreate(input: $input) { id }
}
""", {"input": {"projectId": PROJECT_ID, "name": "redis"}}, soft=True)
    RD_ID = (rd2.get("redisCreate") or {}).get("id")

if not RD_ID:
    cli("railway add --database redis --yes 2>/dev/null || "
        "railway add --plugin redis --yes 2>/dev/null || "
        "railway database add redis 2>/dev/null || true", check=False)
    print("  Redis created via CLI")
else:
    print(f"  Redis ID: {RD_ID}")

print("  Waiting 5s...")
time.sleep(5)

# ── 5. Fetch connection strings ────────────────────────────────
step(5, "Fetch database connection strings")

# Query shared project variables
vars_q = gql("""
query($projectId: String!, $environmentId: String!) {
  variables(projectId: $projectId, environmentId: $environmentId)
}
""", {"projectId": PROJECT_ID, "environmentId": ENV_ID}, soft=True)
shared = vars_q.get("variables") or {}
print(f"  Shared vars found: {list(shared.keys())}")

# Also query plugin-level variables if we have IDs
def get_plugin_vars(plugin_id):
    pv = gql("""
query($pluginId: String!, $environmentId: String!) {
  pluginVariables(pluginId: $pluginId, environmentId: $environmentId)
}
""", {"pluginId": plugin_id, "environmentId": ENV_ID}, soft=True)
    return pv.get("pluginVariables") or {}

all_db_vars = dict(shared)
if PG_ID:
    all_db_vars.update(get_plugin_vars(PG_ID))
if RD_ID:
    all_db_vars.update(get_plugin_vars(RD_ID))

print(f"  All db vars: {list(all_db_vars.keys())}")

# Extract and convert postgres URL
RAW_PG = ""
for k in ["DATABASE_PRIVATE_URL", "DATABASE_URL", "POSTGRES_URL", "PGURL"]:
    if all_db_vars.get(k):
        RAW_PG = all_db_vars[k]
        print(f"  Using postgres var: {k}")
        break

DATABASE_URL = RAW_PG
if RAW_PG.startswith("postgres://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgres://"):]
elif RAW_PG.startswith("postgresql://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgresql://"):]
if not DATABASE_URL:
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@postgres.railway.internal:5432/railway"
    print("  WARNING: Could not find postgres URL, using internal hostname placeholder")

# Extract redis URL
RAW_REDIS = ""
for k in ["REDIS_PRIVATE_URL", "REDIS_URL", "REDISURL"]:
    if all_db_vars.get(k):
        RAW_REDIS = all_db_vars[k]
        print(f"  Using redis var: {k}")
        break
REDIS_URL = RAW_REDIS or "redis://default:@redis.railway.internal:6379/0"

print(f"  DATABASE_URL: {DATABASE_URL[:70]}...")
print(f"  REDIS_URL:    {REDIS_URL[:70]}...")

# ── 6. Qdrant service (Docker image) ──────────────────────────
step(6, "Create Qdrant vector store (Docker image)")
qdrant = gql("""
mutation($input: ServiceCreateInput!) {
  serviceCreate(input: $input) { id name }
}
""", {"input": {
    "projectId": PROJECT_ID,
    "name": "qdrant",
    "source": {"image": "qdrant/qdrant:latest"}
}})
QDRANT_ID = qdrant["serviceCreate"]["id"]
print(f"  Qdrant ID: {QDRANT_ID}")

# ── 7. Create service slots ────────────────────────────────────
step(7, "Create backend / celery / celery-beat / frontend service slots")
SVCS = {}
for name in ["backend", "celery", "celery-beat", "frontend"]:
    s = gql("""
mutation($input: ServiceCreateInput!) {
  serviceCreate(input: $input) { id name }
}
""", {"input": {"projectId": PROJECT_ID, "name": name}})
    SVCS[name] = s["serviceCreate"]["id"]
    print(f"  {name}: {SVCS[name]}")

# ── 8. Set environment variables ──────────────────────────────
step(8, "Set environment variables")

BASE = {
    "DATABASE_URL": DATABASE_URL,
    "REDIS_URL": REDIS_URL,
    "QDRANT_HOST": "qdrant.railway.internal",
    "QDRANT_PORT": "6333",
    "ANTHROPIC_API_KEY": ANTHROPIC_KEY,
    "ENVIRONMENT": "production",
    "REQUIRE_AUTH": "false",
    "ENABLE_RATE_LIMIT": "false",
}

SVC_VARS = {
    "backend":     {**BASE, "PORT": "8000"},
    "celery":      {**BASE},
    "celery-beat": {**BASE},
    "frontend":    {
        "NEXT_PUBLIC_API_URL": "PLACEHOLDER_UPDATED_AFTER_DEPLOY",
        "NEXT_PUBLIC_REQUIRE_AUTH": "false",
        "PORT": "3000",
    },
}

for name, svc_id in SVCS.items():
    gql("""
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
""", {"input": {
        "projectId": PROJECT_ID,
        "environmentId": ENV_ID,
        "serviceId": svc_id,
        "variables": SVC_VARS[name],
    }})
    print(f"  Set vars for {name}")

# ── 9. Override start commands for Celery services ─────────────
step(9, "Set Celery start command overrides")

CELERY_CMD = "celery -A app.workers.celery_app worker --loglevel=info --concurrency=2"
BEAT_CMD = "celery -A app.workers.celery_app beat --loglevel=info"

for name, cmd in [("celery", CELERY_CMD), ("celery-beat", BEAT_CMD)]:
    svc_id = SVCS[name]
    # Try serviceInstanceUpdate (sets the start command)
    r = gql("""
mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}
""", {"serviceId": svc_id, "environmentId": ENV_ID,
         "input": {"startCommand": cmd}}, soft=True)
    if r:
        print(f"  {name}: start command set via API")
    else:
        # Fallback: RAILWAY_RUN_CMD env var (Railway respects this)
        gql("""
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
""", {"input": {
            "projectId": PROJECT_ID,
            "environmentId": ENV_ID,
            "serviceId": svc_id,
            "variables": {**SVC_VARS[name], "RAILWAY_RUN_CMD": cmd},
        }})
        print(f"  {name}: start command set via RAILWAY_RUN_CMD env var")

# ── 10. Deploy code via railway up ────────────────────────────
step(10, "Upload and deploy service code")

backend_dir = os.path.join(PLATFORM, "backend")
frontend_dir = os.path.join(PLATFORM, "frontend")

for name in ["backend", "celery", "celery-beat"]:
    svc_id = SVCS[name]
    print(f"\n  Deploying {name} (from backend dir)...")
    # Try by service ID first, then by name
    ok = cli(
        f"RAILWAY_SERVICE_ID={svc_id} railway up --detach 2>&1 || "
        f"railway up --service {name} --detach 2>&1 || "
        f"railway up --service {svc_id} --detach 2>&1 || true",
        cwd=backend_dir, check=False
    )
    print(f"  {name} upload {'succeeded' if ok else 'may need manual trigger in Railway dashboard'}")

print("\n  Deploying frontend...")
frontend_svc_id = SVCS["frontend"]
ok = cli(
    f"RAILWAY_SERVICE_ID={frontend_svc_id} railway up --detach 2>&1 || "
    f"railway up --service frontend --detach 2>&1 || "
    f"railway up --service {frontend_svc_id} --detach 2>&1 || true",
    cwd=frontend_dir, check=False
)
print(f"  frontend upload {'succeeded' if ok else 'may need manual trigger in Railway dashboard'}")

# ── 11. Generate public domains ───────────────────────────────
step(11, "Generate public HTTPS domains")

BACKEND_URL = ""
FRONTEND_URL = ""

for name, svc_id in [("backend", SVCS["backend"]), ("frontend", SVCS["frontend"])]:
    d = gql("""
mutation($serviceId: String!, $environmentId: String!) {
  serviceDomainCreate(serviceId: $serviceId, environmentId: $environmentId) {
    domain
  }
}
""", {"serviceId": svc_id, "environmentId": ENV_ID}, soft=True)
    if d and d.get("serviceDomainCreate"):
        url = "https://" + d["serviceDomainCreate"]["domain"]
        print(f"  {name}: {url}")
        if name == "backend":
            BACKEND_URL = url
        if name == "frontend":
            FRONTEND_URL = url
    else:
        print(f"  {name}: domain will appear in Railway dashboard after first deploy")

# Update frontend with the real backend URL
if BACKEND_URL:
    gql("""
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
""", {"input": {
        "projectId": PROJECT_ID,
        "environmentId": ENV_ID,
        "serviceId": SVCS["frontend"],
        "variables": {
            "NEXT_PUBLIC_API_URL": BACKEND_URL,
            "NEXT_PUBLIC_REQUIRE_AUTH": "false",
            "PORT": "3000",
        },
    }})
    print(f"  Updated frontend NEXT_PUBLIC_API_URL -> {BACKEND_URL}")

# ── DONE ──────────────────────────────────────────────────────
print("""
\n
" + "="*60)
print("  DEPLOYMENT COMPLETE")
print("="*60)
print(f"""
  Railway Dashboard:
  https://railway.app/project/{PROJECT_ID}

  Services are building now (3-5 min each).
  Watch progress in the Railway dashboard above.
""")

if FRONTEND_URL:
    print(f"  Frontend: {FRONTEND_URL}")
else:
    print("  Frontend URL: will appear in Railway dashboard after build")

if BACKEND_URL:
    print(f"  Backend:  {BACKEND_URL}")
else:
    print("  Backend URL:  will appear in Railway dashboard after build")

if BACKEND_URL:
    print(f"""
  First steps once deployed:

  1. Create your admin API key:
     curl -X POST {BACKEND_URL}/auth/keys \\
       -H 'Content-Type: application/json' \\
       -d '{{"name": "admin"}}'

  2. Copy the 'key' field (shown once).

  3. Visit {FRONTEND_URL or '<frontend-url>'}
     and enter your key on the login screen.
""")
