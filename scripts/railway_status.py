#!/usr/bin/env python3
"""
AgentOS Railway status + domain generation.
Runs from GitHub Actions where backboard.railway.app is reachable.

- Finds the agentos-platform project (by known ID, falls back to name lookup).
- Reports every service's latest deployment status (build health).
- Generates public HTTPS domains for backend + frontend using the correct
  serviceDomainCreate signature (introspected at runtime).
- Writes results to railway_deployment.txt.
"""
import os, json
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
KNOWN_PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
KNOWN_ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")

HEADERS = {
    "Authorization": "Bearer " + TOKEN,
    "Content-Type": "application/json",
}


def gql(query, variables=None, soft=False):
    payload = {"query": query, "variables": variables or {}}
    r = requests.post(API, json=payload, headers=HEADERS, timeout=30)
    if r.status_code != 200:
        if soft:
            print("  [http " + str(r.status_code) + "] " + r.text[:300])
            return {}
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


def step(n, msg):
    print("\n" + "=" * 60 + "\n  [" + str(n) + "] " + msg + "\n" + "=" * 60, flush=True)


# 1. Load project (try known ID, then look it up by name)
step(1, "Load project")
PROJECT_ID = KNOWN_PROJECT_ID
ENV_ID = KNOWN_ENV_ID
proj = gql("""
query($id: String!) {
  project(id: $id) {
    id name
    environments { edges { node { id name } } }
    services { edges { node { id name } } }
  }
}
""", {"id": PROJECT_ID}, soft=True)

node = proj.get("project")
if not node:
    print("  Known project id not found; searching by name 'agentos-platform'...")
    listing = gql("{ projects { edges { node { id name environments { edges { node { id name } } } "
                  "services { edges { node { id name } } } } } } }", soft=True)
    matches = []
    for edge in ((listing.get("projects") or {}).get("edges") or []):
        n = edge.get("node") or {}
        if n.get("name") == "agentos-platform":
            matches.append(n)
    print("  Found " + str(len(matches)) + " project(s) named agentos-platform")
    if matches:
        node = matches[-1]  # newest
        PROJECT_ID = node["id"]

if not node:
    print("  ERROR: could not locate the project.")
    raise SystemExit(1)

print("  Project: " + node.get("name", "?") + " (" + PROJECT_ID + ")")
envs = [(e["node"]["id"], e["node"]["name"]) for e in (node.get("environments") or {}).get("edges", [])]
for eid, ename in envs:
    if ename == "production":
        ENV_ID = eid
print("  Environment (production): " + ENV_ID)

services = {}
for e in (node.get("services") or {}).get("edges", []):
    services[e["node"]["name"]] = e["node"]["id"]
print("  Services: " + ", ".join(sorted(services.keys())))

# 2. Build/deployment health per service
step(2, "Deployment status per service")
status_report = {}
for name, sid in sorted(services.items()):
    dep = gql("""
    query($projectId: String!, $serviceId: String!, $environmentId: String!) {
      deployments(
        first: 1
        input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }
      ) {
        edges { node { id status createdAt staticUrl url } }
      }
    }
    """, {"projectId": PROJECT_ID, "serviceId": sid, "environmentId": ENV_ID}, soft=True)
    edges = ((dep.get("deployments") or {}).get("edges") or [])
    if edges:
        d = edges[0]["node"]
        st = d.get("status", "UNKNOWN")
        status_report[name] = st
        extra = d.get("staticUrl") or d.get("url") or ""
        print("  " + name.ljust(14) + " " + st + ("  " + extra if extra else ""))
    else:
        status_report[name] = "NO_DEPLOYMENT"
        print("  " + name.ljust(14) + " NO_DEPLOYMENT (no build triggered yet)")

# 3. Introspect serviceDomainCreate signature
step(3, "Introspect serviceDomainCreate")
mut = gql('{ __type(name: "Mutation") { fields { name args { name type { name kind ofType { name kind } } } } } }', soft=True)
domain_args = None
for f in (((mut.get("__type") or {}).get("fields")) or []):
    if f["name"] == "serviceDomainCreate":
        domain_args = f.get("args") or []
        break
arg_names = [a["name"] for a in (domain_args or [])]
print("  serviceDomainCreate args: " + str(arg_names))

uses_input = "input" in arg_names
input_fields = []
if uses_input:
    it = gql('{ __type(name: "ServiceDomainCreateInput") { inputFields { name type { name kind ofType { name kind } } } } }', soft=True)
    input_fields = [x["name"] for x in (((it.get("__type") or {}).get("inputFields")) or [])]
    print("  ServiceDomainCreateInput fields: " + str(input_fields))


def make_domain(name, sid, target_port=None):
    """Try to create a public domain for a service, handling both API shapes."""
    if uses_input:
        inp = {"serviceId": sid, "environmentId": ENV_ID}
        if target_port and "targetPort" in input_fields:
            inp["targetPort"] = target_port
        r = gql("""
        mutation($input: ServiceDomainCreateInput!) {
          serviceDomainCreate(input: $input) { domain }
        }
        """, {"input": inp}, soft=True)
    else:
        r = gql("""
        mutation($serviceId: String!, $environmentId: String!) {
          serviceDomainCreate(serviceId: $serviceId, environmentId: $environmentId) { domain }
        }
        """, {"serviceId": sid, "environmentId": ENV_ID}, soft=True)
    dc = r.get("serviceDomainCreate")
    if isinstance(dc, list):
        dc = dc[0] if dc else None
    if dc and dc.get("domain"):
        return "https://" + dc["domain"]
    return ""


# 4. Check for existing domains first, then generate if missing
step(4, "Fetch or generate public domains")
PORTS = {"backend": 8000, "frontend": 3000}
result_urls = {}
for name in ["backend", "frontend"]:
    sid = services.get(name)
    if not sid:
        print("  " + name + ": service missing")
        continue
    # existing domains?
    existing = gql("""
    query($serviceId: String!, $environmentId: String!) {
      domains(serviceId: $serviceId, environmentId: $environmentId) {
        serviceDomains { domain }
      }
    }
    """, {"serviceId": sid, "environmentId": ENV_ID}, soft=True)
    sds = ((existing.get("domains") or {}).get("serviceDomains")) or []
    if sds and sds[0].get("domain"):
        url = "https://" + sds[0]["domain"]
        result_urls[name] = url
        print("  " + name + ": existing -> " + url)
        continue
    url = make_domain(name, sid, PORTS.get(name))
    if url:
        result_urls[name] = url
        print("  " + name + ": created  -> " + url)
    else:
        print("  " + name + ": could not create domain (see warnings above)")

BACKEND_URL = result_urls.get("backend", "")
FRONTEND_URL = result_urls.get("frontend", "")

# 5. If backend URL now exists, point the frontend at it
if BACKEND_URL and services.get("frontend"):
    gql("""
    mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
    """, {"input": {
        "projectId": PROJECT_ID, "environmentId": ENV_ID,
        "serviceId": services["frontend"],
        "variables": {"NEXT_PUBLIC_API_URL": BACKEND_URL},
    }}, soft=True)
    print("  Frontend NEXT_PUBLIC_API_URL set to " + BACKEND_URL)

# 6. Write report
DASHBOARD_URL = "https://railway.com/project/" + PROJECT_ID
lines = [
    "RAILWAY_PROJECT_ID=" + PROJECT_ID,
    "RAILWAY_ENVIRONMENT_ID=" + ENV_ID,
    "RAILWAY_DASHBOARD=" + DASHBOARD_URL,
    "BACKEND_URL=" + (BACKEND_URL or "not-generated"),
    "FRONTEND_URL=" + (FRONTEND_URL or "not-generated"),
]
for name in sorted(status_report.keys()):
    lines.append("STATUS_" + name.upper().replace("-", "_") + "=" + status_report[name])
with open("railway_deployment.txt", "w") as f:
    f.write("\n".join(lines) + "\n")

print("\n" + "=" * 60)
print("  STATUS SUMMARY")
print("=" * 60)
for l in lines:
    print("  " + l)
