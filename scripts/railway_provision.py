#!/usr/bin/env python3
"""
Provision Postgres + Redis for the AgentOS project (they were never created), wire the
real connection strings into backend/celery/celery-beat, and redeploy those services.

Auth: the account token authenticates the GraphQL API via Bearer, and the Railway CLI via
RAILWAY_API_TOKEN (NOT RAILWAY_TOKEN, which is for project-scoped tokens).
"""
import os, json, subprocess, time
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")
HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
LOG = []


def emit(s):
    print(s, flush=True)
    LOG.append(s)


def gql(query, variables=None, soft=True):
    r = requests.post(API, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=40)
    if r.status_code != 200:
        emit("  [http " + str(r.status_code) + "] " + r.text[:300])
        return {}
    data = r.json()
    if "errors" in data:
        emit("  [warn] " + json.dumps(data["errors"])[:300])
        return data.get("data", {}) or {}
    return data.get("data", {})


def run(cmd, cwd=None):
    emit("\n  $ " + cmd)
    env = {k: v for k, v in os.environ.items() if k != "RAILWAY_TOKEN"}
    env["RAILWAY_API_TOKEN"] = TOKEN
    try:
        r = subprocess.run(cmd, shell=True, text=True, cwd=cwd, env=env, capture_output=True, timeout=300)
    except subprocess.TimeoutExpired:
        emit("  [timeout]")
        return False, ""
    out = (r.stdout or "") + (r.stderr or "")
    for ln in out.strip().splitlines():
        emit("    " + ln)
    emit("  [exit " + str(r.returncode) + "]")
    return r.returncode == 0, out


def load_services():
    proj = gql("""
    query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }
    """, {"id": PROJECT_ID})
    svc = {}
    for e in ((proj.get("project") or {}).get("services") or {}).get("edges", []):
        svc[e["node"]["name"].lower()] = e["node"]["id"]
    return svc


def svc_vars(sid):
    v = gql("""
    query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }
    """, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": sid})
    return v.get("variables") or {}


emit("=== Link project via CLI ===")
run("railway link --project " + PROJECT_ID + " --environment " + ENV_ID)

emit("\n=== Existing services ===")
services = load_services()
emit("  " + json.dumps(services))

# Create databases if missing
if not any(k in services for k in ("postgres", "postgresql")):
    emit("\n=== Add Postgres ===")
    ok, _ = run("railway add --database postgres")
    if not ok:
        run("railway add -d postgres")
else:
    emit("\n  Postgres already exists")

if "redis" not in services:
    emit("\n=== Add Redis ===")
    ok, _ = run("railway add --database redis")
    if not ok:
        run("railway add -d redis")
else:
    emit("\n  Redis already exists")

emit("\n=== Wait for databases to register ===")
time.sleep(30)
services = load_services()
emit("  services now: " + json.dumps(services))

pg_id = services.get("postgres") or services.get("postgresql")
rd_id = services.get("redis")

RAW_PG = ""
if pg_id:
    pv = svc_vars(pg_id)
    emit("  postgres vars: " + json.dumps(sorted(pv.keys())))
    for k in ("DATABASE_PRIVATE_URL", "DATABASE_URL"):
        if pv.get(k):
            RAW_PG = pv[k]; emit("  using postgres key: " + k); break

RAW_RD = ""
if rd_id:
    rv = svc_vars(rd_id)
    emit("  redis vars: " + json.dumps(sorted(rv.keys())))
    for k in ("REDIS_PRIVATE_URL", "REDIS_URL"):
        if rv.get(k):
            RAW_RD = rv[k]; emit("  using redis key: " + k); break

# Convert to asyncpg driver
DATABASE_URL = RAW_PG
if RAW_PG.startswith("postgres://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgres://"):]
elif RAW_PG.startswith("postgresql://"):
    DATABASE_URL = "postgresql+asyncpg://" + RAW_PG[len("postgresql://"):]
REDIS_URL = RAW_RD

emit("\n  DATABASE_URL resolved: " + ("yes" if DATABASE_URL else "NO"))
emit("  REDIS_URL resolved:    " + ("yes" if REDIS_URL else "NO"))

if not DATABASE_URL or not REDIS_URL:
    emit("\n  ERROR: could not resolve DB connection strings; aborting before wiring.")
    with open("railway_provision.txt", "w") as f:
        f.write("\n".join(LOG) + "\nRESULT=FAILED_NO_DB_URL\n")
    raise SystemExit(1)

# Wire the connection strings into the app services
emit("\n=== Set DATABASE_URL / REDIS_URL on app services ===")
for name in ("backend", "celery", "celery-beat"):
    sid = services.get(name)
    if not sid:
        emit("  " + name + ": missing service id"); continue
    gql("""
    mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }
    """, {"input": {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": sid,
                     "variables": {"DATABASE_URL": DATABASE_URL, "REDIS_URL": REDIS_URL}}})
    emit("  " + name + ": vars set")

# Redeploy the app services (their build is fine; they just need the new env)
emit("\n=== Redeploy app services ===")
for name in ("backend", "celery", "celery-beat"):
    sid = services.get(name)
    if not sid:
        continue
    r = gql("""
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
    """, {"serviceId": sid, "environmentId": ENV_ID})
    if r:
        emit("  " + name + ": redeploy via API")
    else:
        run("railway redeploy --service " + name + " --yes")

with open("railway_provision.txt", "w") as f:
    f.write("\n".join(LOG) + "\nRESULT=OK\nHAS_DB=" + ("1" if DATABASE_URL else "0") + "\n")
emit("\n=== DONE ===")
