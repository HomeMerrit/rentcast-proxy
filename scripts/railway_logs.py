#!/usr/bin/env python3
"""
Fetch Railway build + deploy logs for the AgentOS services and commit them so we can
diagnose build failures from outside the CI runner.
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


# Load services + latest deployment id/status
proj = gql("""
query($id: String!) { project(id: $id) { name services { edges { node { id name } } } } }
""", {"id": PROJECT_ID})
node = proj.get("project") or {}
services = {e["node"]["name"]: e["node"]["id"] for e in (node.get("services") or {}).get("edges", [])}
emit("Services: " + json.dumps(services))

TARGETS = ["backend", "celery", "celery-beat", "frontend"]
for name in TARGETS:
    sid = services.get(name)
    if not sid:
        continue
    dep = gql("""
    query($projectId: String!, $serviceId: String!, $environmentId: String!) {
      deployments(first: 1, input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }) {
        edges { node { id status createdAt } }
      }
    }
    """, {"projectId": PROJECT_ID, "serviceId": sid, "environmentId": ENV_ID})
    edges = ((dep.get("deployments") or {}).get("edges") or [])
    if not edges:
        emit("\n########## " + name + " : NO DEPLOYMENT ##########")
        continue
    d = edges[0]["node"]
    dep_id = d["id"]
    emit("\n########## " + name + " : " + d["status"] + " (deployment " + dep_id + ") ##########")

    # Build logs
    bl = gql("""
    query($deploymentId: String!, $limit: Int) {
      buildLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message severity }
    }
    """, {"deploymentId": dep_id, "limit": 400})
    logs = bl.get("buildLogs")
    if logs:
        emit("---- BUILD LOGS (" + name + ") ----")
        for entry in logs[-120:]:
            emit("  " + (entry.get("message") or ""))
    else:
        emit("  (no buildLogs)")

    # Runtime / deploy logs (crash reasons live here)
    dl = gql("""
    query($deploymentId: String!, $limit: Int) {
      deploymentLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message severity }
    }
    """, {"deploymentId": dep_id, "limit": 400})
    dlogs = dl.get("deploymentLogs")
    if dlogs:
        emit("---- RUNTIME LOGS (" + name + ") ----")
        for entry in dlogs[-120:]:
            emit("  " + (entry.get("message") or ""))
    else:
        emit("  (no runtime logs)")

with open("railway_logs.txt", "w") as f:
    f.write("\n".join(OUT) + "\n")
emit("\n=== wrote railway_logs.txt (" + str(len(OUT)) + " lines) ===")
