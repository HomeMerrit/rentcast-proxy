#!/usr/bin/env python3
"""
Finalize the deployment:
  1. Keep ONE canonical public domain per service (backend, frontend); delete the extras.
  2. Bake the canonical backend URL into the frontend build-time env
     (NEXT_PUBLIC_API_URL / NEXT_PUBLIC_STREAM_URL) so the browser UI reaches the API.
The frontend must be rebuilt afterward for the baked vars to take effect.
"""
import os, json
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")
HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
# canonical domains to KEEP
KEEP = {"backend": "backend-production-a20b.up.railway.app",
        "frontend": "frontend-production-a9cc3.up.railway.app"}
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


proj = gql("query($id: String!){ project(id:$id){ services{ edges{ node{ id name } } } } }", {"id": PROJECT_ID})
services = {e["node"]["name"]: e["node"]["id"] for e in ((proj.get("project") or {}).get("services") or {}).get("edges", [])}

# Introspect delete mutation arg
dm = gql('{ __type(name: "Mutation") { fields { name args { name } } } }')
del_args = None
for f in (((dm.get("__type") or {}).get("fields")) or []):
    if f["name"] == "serviceDomainDelete":
        del_args = [a["name"] for a in (f.get("args") or [])]
emit("serviceDomainDelete args: " + json.dumps(del_args))

# 1. Dedupe domains
for name in ("backend", "frontend"):
    sid = services.get(name)
    if not sid:
        continue
    emit("\n=== " + name + " domains ===")
    dd = gql("""
    query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        serviceDomains { id domain }
      }
    }
    """, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": sid})
    sds = ((dd.get("domains") or {}).get("serviceDomains") or [])
    keep = KEEP[name]
    for sd in sds:
        if sd["domain"] == keep:
            emit("  keep:   " + sd["domain"])
            continue
        # delete extra
        r = gql("mutation($id: String!){ serviceDomainDelete(id: $id) }", {"id": sd["id"]})
        emit("  delete: " + sd["domain"] + "  -> " + ("ok" if r else "FAILED"))

# 2. Bake backend URL into frontend build-time env
fe = services.get("frontend")
if fe:
    backend_url = "https://" + KEEP["backend"]
    emit("\n=== Set frontend NEXT_PUBLIC_* -> " + backend_url + " ===")
    r = gql("""
    mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }
    """, {"input": {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": fe,
                     "variables": {"NEXT_PUBLIC_API_URL": backend_url,
                                    "NEXT_PUBLIC_STREAM_URL": backend_url,
                                    "NEXT_PUBLIC_REQUIRE_AUTH": "false",
                                    "PORT": "3000"}}})
    emit("  frontend env set: " + ("ok" if r else "FAILED"))

with open("railway_finalize.txt", "w") as f:
    f.write("\n".join(OUT) + "\nKEPT_BACKEND=https://" + KEEP["backend"] + "\nKEPT_FRONTEND=https://" + KEEP["frontend"] + "\n")
emit("\n=== DONE ===")
