#!/usr/bin/env python3
"""
Deploy AgentOS code to the existing Railway services via `railway up` (tarball upload).
Runs from GitHub Actions. Captures ALL CLI output to a committed log so failures are visible.

Targets the existing agentos-platform project. For each code service it links the
service non-interactively, then uploads + builds the appropriate source directory:
  backend, celery, celery-beat  -> agent-platform/backend
  frontend                      -> agent-platform/frontend
"""
import os, json, subprocess, time
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
WORKSPACE = os.environ.get("GITHUB_WORKSPACE", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLATFORM = os.path.join(WORKSPACE, "agent-platform")
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")

HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
LOG = []


def logline(s):
    print(s, flush=True)
    LOG.append(s)


def gql(query, variables=None, soft=False):
    r = requests.post(API, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        if soft:
            logline("  [http " + str(r.status_code) + "] " + r.text[:300])
            return {}
        r.raise_for_status()
    data = r.json()
    if "errors" in data:
        msg = json.dumps(data["errors"])
        if soft:
            logline("  [warn] " + msg[:300])
            return {}
        raise RuntimeError("GraphQL error: " + msg)
    return data.get("data", {})


def run(cmd, cwd=None):
    """Run a shell command, capture combined output into the log, return (ok, output).

    The Railway CLI expects an ACCOUNT/team token in RAILWAY_API_TOKEN (a project-scoped
    token would go in RAILWAY_TOKEN). Our token is an account token that authenticates the
    GraphQL API, so we must expose it as RAILWAY_API_TOKEN and clear RAILWAY_TOKEN, otherwise
    the CLI treats it as an invalid project token and returns "Invalid RAILWAY_TOKEN".
    """
    logline("\n  $ " + cmd + (("   (cwd=" + cwd + ")") if cwd else ""))
    env = {k: v for k, v in os.environ.items() if k != "RAILWAY_TOKEN"}
    env["RAILWAY_API_TOKEN"] = TOKEN
    try:
        r = subprocess.run(cmd, shell=True, text=True, cwd=cwd, env=env,
                           capture_output=True, timeout=900)
    except subprocess.TimeoutExpired as e:
        logline("  [timeout] " + str(e)[:200])
        return False, "timeout"
    out = (r.stdout or "") + (r.stderr or "")
    for ln in out.strip().splitlines():
        logline("    " + ln)
    logline("  [exit " + str(r.returncode) + "]")
    return r.returncode == 0, out


# ---- Load service IDs -------------------------------------------------------
logline("=== Load project services ===")
proj = gql("""
query($id: String!) {
  project(id: $id) {
    id name
    services { edges { node { id name } } }
  }
}
""", {"id": PROJECT_ID}, soft=True)
node = proj.get("project") or {}
services = {}
for e in (node.get("services") or {}).get("edges", []):
    services[e["node"]["name"]] = e["node"]["id"]
logline("  Project: " + node.get("name", "?") + " (" + PROJECT_ID + ")")
logline("  Services: " + json.dumps(services, indent=2))

# ---- Set celery start commands via API -------------------------------------
logline("\n=== Set celery start commands ===")
CMDS = {
    "celery": "celery -A app.workers.celery_app worker --loglevel=info --concurrency=2",
    "celery-beat": "celery -A app.workers.celery_app beat --loglevel=info",
}
for name, cmd in CMDS.items():
    sid = services.get(name)
    if not sid:
        continue
    r = gql("""
    mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }
    """, {"serviceId": sid, "environmentId": ENV_ID, "input": {"startCommand": cmd}}, soft=True)
    logline("  " + name + ": startCommand " + ("set" if r else "FAILED (will rely on Dockerfile CMD)"))

# ---- CLI diagnostics --------------------------------------------------------
logline("\n=== Railway CLI diagnostics ===")
run("railway --version")
run("railway whoami")

# ---- Deploy each code service ----------------------------------------------
SOURCES = {
    "backend": os.path.join(PLATFORM, "backend"),
    "celery": os.path.join(PLATFORM, "backend"),
    "celery-beat": os.path.join(PLATFORM, "backend"),
    "frontend": os.path.join(PLATFORM, "frontend"),
}

deployed = {}
_filter = os.environ.get("DEPLOY_SERVICES", "").strip()
_wanted = [s.strip() for s in _filter.split(",") if s.strip()] if _filter else ["backend", "celery", "celery-beat", "frontend"]
logline("\n  Deploying services: " + ", ".join(_wanted))
for name in _wanted:
    sid = services.get(name)
    src = SOURCES[name]
    logline("\n=== Deploy " + name + " ===")
    if not sid:
        logline("  service id missing, skipping")
        deployed[name] = "NO_SERVICE_ID"
        continue
    if not os.path.isdir(src):
        logline("  source dir missing: " + src)
        deployed[name] = "NO_SOURCE_DIR"
        continue

    # Link the service non-interactively IN the source dir so .railway/config.json
    # lands next to the code that `railway up` will upload.
    link_ok, _ = run("railway link --project " + PROJECT_ID + " --environment " + ENV_ID + " --service " + sid, cwd=src)
    if not link_ok:
        run("railway link -p " + PROJECT_ID + " -e " + ENV_ID + " -s " + sid, cwd=src)

    # Upload + build (detached). Prefer the linked config; fall back to explicit service.
    up_ok, up_out = run("railway up --detach", cwd=src)
    if not up_ok:
        up_ok, up_out = run("railway up --service " + sid + " --environment " + ENV_ID + " --detach", cwd=src)
    deployed[name] = "UP_OK" if up_ok else "UP_FAILED"

# ---- Poll deployment status -------------------------------------------------
logline("\n=== Poll deployment status (30s) ===")
time.sleep(30)
status = {}
for name, sid in services.items():
    dep = gql("""
    query($projectId: String!, $serviceId: String!, $environmentId: String!) {
      deployments(first: 1, input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }) {
        edges { node { id status } }
      }
    }
    """, {"projectId": PROJECT_ID, "serviceId": sid, "environmentId": ENV_ID}, soft=True)
    edges = ((dep.get("deployments") or {}).get("edges") or [])
    status[name] = edges[0]["node"]["status"] if edges else "NO_DEPLOYMENT"
    logline("  " + name.ljust(14) + " " + status[name])

# ---- Write outputs ----------------------------------------------------------
with open("railway_deploy_log.txt", "w") as f:
    f.write("\n".join(LOG) + "\n")

summary = ["RAILWAY_PROJECT_ID=" + PROJECT_ID,
           "RAILWAY_DASHBOARD=https://railway.com/project/" + PROJECT_ID]
for name in sorted(status.keys()):
    summary.append("STATUS_" + name.upper().replace("-", "_") + "=" + status[name])
for name in sorted(deployed.keys()):
    summary.append("UPLOAD_" + name.upper().replace("-", "_") + "=" + deployed[name])
with open("railway_deploy_result.txt", "w") as f:
    f.write("\n".join(summary) + "\n")

logline("\n=== RESULT ===")
for s in summary:
    logline("  " + s)
