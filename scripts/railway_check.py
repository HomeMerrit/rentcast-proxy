#!/usr/bin/env python3
"""
Read-only Railway check: reports each service's latest deployment status AND its
actually-attached public domains. Does NOT create domains (avoids duplicates).
"""
import os, json
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")
HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
OUT = []


def emit(s):
    print(s, flush=True)
    OUT.append(s)


def gql(query, variables=None):
    r = requests.post(API, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=40)
    if r.status_code != 200:
        emit("  [http " + str(r.status_code) + "] " + r.text[:300])
        return {}
    data = r.json()
    if "errors" in data:
        emit("  [warn] " + json.dumps(data["errors"])[:300])
        return data.get("data", {}) or {}
    return data.get("data", {})


proj = gql("""
query($id: String!) { project(id: $id) { name services { edges { node { id name } } } } }
""", {"id": PROJECT_ID})
node = proj.get("project") or {}
services = {e["node"]["name"]: e["node"]["id"] for e in (node.get("services") or {}).get("edges", [])}
emit("Project: " + node.get("name", "?"))

# Domains must be queried per service (serviceId is required)
def domains_for(sid):
    dd = gql("""
    query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        serviceDomains { domain }
        customDomains { domain }
      }
    }
    """, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": sid})
    d = dd.get("domains") or {}
    return [x.get("domain") for x in (d.get("serviceDomains") or []) + (d.get("customDomains") or []) if x.get("domain")]

dom_by_service = {sid: domains_for(sid) for sid in services.values()}

emit("\n=== SERVICE STATUS + DOMAINS ===")
result = {}
for name in ["backend", "frontend", "celery", "celery-beat", "qdrant"]:
    sid = services.get(name)
    if not sid:
        continue
    dep = gql("""
    query($projectId: String!, $serviceId: String!, $environmentId: String!) {
      deployments(first: 1, input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }) {
        edges { node { status } }
      }
    }
    """, {"projectId": PROJECT_ID, "serviceId": sid, "environmentId": ENV_ID})
    edges = ((dep.get("deployments") or {}).get("edges") or [])
    st = edges[0]["node"]["status"] if edges else "NO_DEPLOYMENT"
    doms = dom_by_service.get(sid, [])
    result[name] = {"status": st, "domains": doms}
    emit("  " + name.ljust(13) + " " + st.ljust(14) + " " + (", ".join(doms) if doms else "(no domain)"))

# HTTP probe each service's domains from the runner (open internet, unlike the sandbox)
emit("\n=== HTTP PROBES (from runner) ===")
probes = {}
probe_paths = {"backend": "/health", "frontend": "/"}
for name in ("backend", "frontend"):
    sid = services.get(name)
    if not sid:
        continue
    path = probe_paths[name]
    for dom in dom_by_service.get(sid, []):
        url = "https://" + dom + path
        try:
            resp = requests.get(url, timeout=25)
            body = (resp.text or "")[:120].replace("\n", " ")
            probes[url] = resp.status_code
            emit("  " + str(resp.status_code) + "  " + url + "   " + body)
        except Exception as e:
            probes[url] = "ERR"
            emit("  ERR " + url + "  " + str(e)[:120])

with open("railway_check.txt", "w") as f:
    f.write("\n".join(OUT) + "\nJSON=" + json.dumps(result) + "\nPROBES=" + json.dumps(probes) + "\n")
emit("\nJSON=" + json.dumps(result))
