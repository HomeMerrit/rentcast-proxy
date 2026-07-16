#!/usr/bin/env python3
"""
AgentOS -> Railway full-stack deployment.
Runs from GitHub Actions where backboard.railway.app is reachable.
Creates: project, postgres, redis, qdrant, backend, celery, celery-beat, frontend.
"""
import os, sys, json, time, subprocess
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "SET_IN_RAILWAY_DASHBOARD")
API = "https://backboard.railway.app/graphql/v2"
WORKSPACE = os.environ.get("GITHUB_WORKSPACE", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLATFORM = os.path.join(WORKSPACE, "agent-platform")

HEADERS = {
    "Authorization": "Bearer " + TOKEN,
    "Content-Type": "application/json",
}


def gql(query, variables=None, soft=False):
    payload = {"query": query, "variables": variables or {}}
    r = requests.post(API, json=payload, headers=HEADERS, timeout=30)
    if r.status_code not in (200, 400):
        print("  [http] " + str(r.status_code) + " " + r.text[:400])
    r.raise_for_status()
    data = r.json()
    if "errors" in data:
        msg = json.dumps(data["errors"], indent=2)
        if soft:
            print("  [warn] " + msg[:400])
            return {}
        raise RuntimeError("GraphQL error:\n" + msg)
    return data.get("data", {})


def cli(cmd, cwd=None, check=True):
    print("\n  $ " + cmd, flush=True)
    env = {**os.environ, "RAILWAY_TOKEN": TOKEN}
    r = subprocess.run(cmd, shell=True, text=True, cwd=cwd, env=env)
    if check and r.returncode != 0:
        raise RuntimeError("Command failed (exit " + str(r.returncode) + "): " + cmd)
    return r.returncode == 0


def step(n, msg):
    print("\n" + "="*60 + "\n  [" + str(n) + "] " + msg + "\n" + "="*60, flush=True)


# 1. Verify auth
step(1, "Verify Railway token")
me = gql("{ me { id email } }")
print("  Authenticated: " + me["me"]["email"])

# 1b. Find workspace/team ID
step("1b", "Find workspace ID")
WORKSPACE_ID = None

# Print available top-level query fields for debugging
schema = gql('{ __schema { queryType { fields { name } } } }', soft=True)
if schema:
    field_names = [f["name"] for f in (schema.get("__schema") or {}).get("queryType", {}).get("fields", [])]
    print("  Available top-level queries: " + str(field_names[:30]))

# Try teams
for q, label, path in [
    ("{ teams { edges { node { id name } } } }", "teams", ["teams", "edges"]),
    ("{ workspaces { edges { node { id name } } } }", "workspaces", ["workspaces", "edges"]),
    ("{ me { id teams { edges { node { id name } } } } }", "me.teams", ["me", "teams", "edges"]),
    ("{ me { id workspaces { edges { node { id name } } } } }", "me.workspaces", ["me", "workspaces", "edges"]),
]:
    result = gql(q, soft=True)
    if result:
        # navigate path
        node = result
        for p in path[:-1]:
            node = (node or {}).get(p) or {}
        edges = (node or {}).get("edges", [])
        if edges:
            WORKSPACE_ID = edges[0]["node"]["id"]
            print("  Workspace ID via '" + label + "': " + WORKSPACE_ID + " (" + edges[0]["node"]["name"] + ")")
            break
        else:
            print("  '" + label + "': query ok but no edges")

if not WORKSPACE_ID:
    raise RuntimeError("Could not find workspace ID via any query. See available queries above.")

# 2. Create project
step(2, "Create Railway project")
proj = gql("""
mutation($name: String!, $workspaceId: String!) {
  projectCreate(input: { name: $name, defaultEnvironmentName: "production" }, workspaceId: $workspaceId) {
    id
    environments { edges { node { id name } } }
  }
}
""", {"name": "agentos-platform", "workspaceId": WORKSPACE_ID})

PROJECT_ID = proj["projectCreate"]["id"]
ENV_ID = proj["projectCreate"]["environments"]["edges"][0]["node"]["id"]
print("  Project ID:     " + PROJECT_ID)
print("  Environment ID: " + ENV_ID)
os.environ["RAILWAY_PROJECT_ID"] = PROJECT_ID
os.environ["RAILWAY_ENVIRONMENT_ID"] = ENV_ID

# 3. Create Postgres
step(3, "Create Postgres database")
PG_ID = None
pg = gql("""
mutation($input: PluginCreateInput!) {
  pluginCreate(input: $input) { id name }
}
""", {"input": {"projectId": PROJECT_ID, "name": "postgres", "plugin": "POSTGRESQL"}}, soft=True)
PG_ID = (pg.get("pluginCreate") or {}).get("id")

if not PG_ID:
    pg2 = gql("""
mutation($input: PostgresCreateInput!) {
  postgresCreate(input: $input) { id }
}
""", {"input": {"projectId": PROJECT_ID, "name": "postgres", "defaultDatabaseName": "railway"}}, soft=True)
    PG_ID = (pg2.get("postgresCreate") or {}).get("id")

if not PG_ID:
    cli("railway add --database postgresql --yes 2>/dev/null || "
        "railway add --plugin postgresql --yes 2>/dev/null || true", check=False)
    print("  Postgres added via CLI")
else:
    print("  Postgres ID: " + PG_ID)

print("  Waiting 8s for database...")
time.sleep(8)

# 4. Create Redis
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
        "railway add --plugin redis --yes 2>/dev/null || true", check=False)
    print("  Redis added via CLI")
else:
    print("  Redis ID: " + RD_ID)

time.sleep(5)

# 5. Fetch connection strings
step(5, "Fetch database connection strings")
vars_q = gql("""
query($projectId: String!, $environmentId: String!) {
  variables(projectId: $projectId, environmentId: $environmentId)
}
""", {"projectId": PROJECT_ID, "environmentId": ENV_ID}, soft=True)
shared = vars_q.get("variables") or {}
print("  Shared vars found: " + str(list(shared.keys())))

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

print("  All db vars: " + str(list(all_db_vars.keys())))

RAW_PG = ""
for k in ["DATABASE_PRIVATE_URL", "DATABASE_URL", "POSTGRES_URL", "PGURL"]:
    if all_db_vars.get(k):
        RAW_PG = all_db_vars[k]
        print("  Using postgres key: " + k)
        break

DATABASE_URL = RAW_PG
if RAW_PG.startswith("postgres://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgres://"):]
elif RAW_PG.startswith("postgresql://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgresql://"):]
if not DATABASE_URL:
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@postgres.railway.internal:5432/railway"
    print("  WARNING: postgres URL not found, using placeholder")

RAW_REDIS = ""
for k in ["REDIS_PRIVATE_URL", "REDIS_URL", "REDISURL"]:
    if all_db_vars.get(k):
        RAW_REDIS = all_db_vars[k]
        print("  Using redis key: " + k)
        break
REDIS_URL = RAW_REDIS or "redis://default:@redis.railway.internal:6379/0"

print("  DATABASE_URL prefix: " + DATABASE_URL[:50] + "...")
print("  REDIS_URL prefix:    " + REDIS_URL[:50] + "...")

# 6. Qdrant service
step(6, "Create Qdrant (Docker image)")
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
print("  Qdrant ID: " + QDRANT_ID)

# 7. Create service slots
step(7, "Create service slots")
SVCS = {}
for name in ["backend", "celery", "celery-beat", "frontend"]:
    s = gql("""
mutation($input: ServiceCreateInput!) {
  serviceCreate(input: $input) { id name }
}
""", {"input": {"projectId": PROJECT_ID, "name": name}})
    SVCS[name] = s["serviceCreate"]["id"]
    print("  " + name + ": " + SVCS[name])

# 8. Set environment variables
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
    "backend":     dict(list(BASE.items()) + [("PORT", "8000")]),
    "celery":      dict(BASE),
    "celery-beat": dict(BASE),
    "frontend":    {
        "NEXT_PUBLIC_API_URL": "WILL_UPDATE_AFTER_DEPLOY",
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
    print("  Set vars for " + name)

# 9. Celery start command overrides
step(9, "Set Celery start commands")
CELERY_CMD = "celery -A app.workers.celery_app worker --loglevel=info --concurrency=2"
BEAT_CMD = "celery -A app.workers.celery_app beat --loglevel=info"
for name, cmd in [("celery", CELERY_CMD), ("celery-beat", BEAT_CMD)]:
    r = gql("""
mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}
""", {"serviceId": SVCS[name], "environmentId": ENV_ID, "input": {"startCommand": cmd}}, soft=True)
    if r:
        print("  " + name + ": start command set via API")
    else:
        vars_with_cmd = dict(SVC_VARS[name])
        vars_with_cmd["RAILWAY_RUN_CMD"] = cmd
        gql("""
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
""", {"input": {
            "projectId": PROJECT_ID, "environmentId": ENV_ID,
            "serviceId": SVCS[name],
            "variables": vars_with_cmd,
        }})
        print("  " + name + ": set RAILWAY_RUN_CMD fallback")

# 10. Deploy code
step(10, "Upload and deploy code via railway up")
backend_dir = os.path.join(PLATFORM, "backend")
frontend_dir = os.path.join(PLATFORM, "frontend")

for name in ["backend", "celery", "celery-beat"]:
    svc_id = SVCS[name]
    print("\n  Deploying " + name + "...")
    cli(
        "RAILWAY_SERVICE_ID=" + svc_id + " railway up --detach 2>&1 || "
        "railway up --service " + name + " --detach 2>&1 || true",
        cwd=backend_dir, check=False
    )

print("\n  Deploying frontend...")
cli(
    "RAILWAY_SERVICE_ID=" + SVCS["frontend"] + " railway up --detach 2>&1 || "
    "railway up --service frontend --detach 2>&1 || true",
    cwd=frontend_dir, check=False
)

# 11. Generate public domains
step(11, "Generate public HTTPS domains")
BACKEND_URL = ""
FRONTEND_URL = ""
for name, svc_id in [("backend", SVCS["backend"]), ("frontend", SVCS["frontend"])]:
    d = gql("""
mutation($serviceId: String!, $environmentId: String!) {
  serviceDomainCreate(serviceId: $serviceId, environmentId: $environmentId) { domain }
}
""", {"serviceId": svc_id, "environmentId": ENV_ID}, soft=True)
    if d and d.get("serviceDomainCreate"):
        url = "https://" + d["serviceDomainCreate"]["domain"]
        print("  " + name + ": " + url)
        if name == "backend":
            BACKEND_URL = url
        if name == "frontend":
            FRONTEND_URL = url
    else:
        print("  " + name + ": domain will appear in Railway dashboard after first build")

if BACKEND_URL:
    gql("""
mutation($input: VariableCollectionUpsertInput!) {
  variableCollectionUpsert(input: $input)
}
""", {"input": {
        "projectId": PROJECT_ID, "environmentId": ENV_ID,
        "serviceId": SVCS["frontend"],
        "variables": {
            "NEXT_PUBLIC_API_URL": BACKEND_URL,
            "NEXT_PUBLIC_REQUIRE_AUTH": "false",
            "PORT": "3000",
        },
    }})
    print("  Frontend NEXT_PUBLIC_API_URL updated to " + BACKEND_URL)

# Done
print("\n" + "="*60)
print("  DEPLOYMENT INITIATED")
print("="*60)
print("")
print("  Railway Dashboard: https://railway.com/project/" + PROJECT_ID)
print("  Services are building now (3-5 min each).")
print("")
if FRONTEND_URL:
    print("  Frontend: " + FRONTEND_URL)
else:
    print("  Frontend URL: check Railway dashboard after builds complete")
if BACKEND_URL:
    print("  Backend:  " + BACKEND_URL)
else:
    print("  Backend URL: check Railway dashboard after builds complete")
print("")
print("  To update ANTHROPIC_API_KEY in Railway dashboard:")
print("  -> backend service -> Variables -> ANTHROPIC_API_KEY")
