#!/usr/bin/env python3
"""
Ensure backend/frontend have exactly one working public domain each, routed to the
correct container port (backend=8000, frontend=3000). Fixes domains that were created
without a targetPort (which makes Railway's edge return no response).
"""
import os, json
import requests

TOKEN = os.environ["RAILWAY_TOKEN"]
API = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "311fa837-720a-4a33-9439-28e7c853bd7a")
ENV_ID = os.environ.get("RAILWAY_ENVIRONMENT_ID", "ef95ba5f-eb20-436b-aff4-948e751c199d")
HEADERS = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
OUT = []
PORTS = {"backend": 8000, "frontend": 3000}


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

# Introspect create/update input fields
def input_fields(type_name):
    it = gql('{ __type(name: "' + type_name + '") { inputFields { name } } }')
    return [x["name"] for x in (((it.get("__type") or {}).get("inputFields")) or [])]

create_fields = input_fields("ServiceDomainCreateInput")
update_fields = input_fields("ServiceDomainUpdateInput")
emit("ServiceDomainCreateInput: " + json.dumps(create_fields))
emit("ServiceDomainUpdateInput: " + json.dumps(update_fields))

result = {}
for name, port in PORTS.items():
    sid = services.get(name)
    if not sid:
        emit("\n" + name + ": no service"); continue
    emit("\n=== " + name + " (want targetPort " + str(port) + ") ===")
    # existing domains with id + targetPort
    dd = gql("""
    query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        serviceDomains { id domain targetPort }
      }
    }
    """, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": sid})
    sds = ((dd.get("domains") or {}).get("serviceDomains") or [])
    emit("  existing: " + json.dumps(sds))

    chosen = None
    for sd in sds:
        if sd.get("targetPort") == port:
            chosen = sd; break
    if chosen:
        emit("  already routed correctly: " + chosen["domain"])
        result[name] = "https://" + chosen["domain"]
        continue

    # Try to update the first existing domain's targetPort
    if sds and "targetPort" in update_fields:
        sd = sds[0]
        id_field = "serviceDomainId" if "serviceDomainId" in update_fields else ("id" if "id" in update_fields else None)
        if id_field:
            inp = {id_field: sd["id"], "targetPort": port}
            r = gql("mutation($input: ServiceDomainUpdateInput!){ serviceDomainUpdate(input:$input) }", {"input": inp})
            if r:
                emit("  updated " + sd["domain"] + " -> targetPort " + str(port))
                result[name] = "https://" + sd["domain"]
                continue

    # Otherwise create a fresh domain with targetPort
    inp = {"serviceId": sid, "environmentId": ENV_ID}
    if "targetPort" in create_fields:
        inp["targetPort"] = port
    r = gql("mutation($input: ServiceDomainCreateInput!){ serviceDomainCreate(input:$input){ domain } }", {"input": inp})
    dc = r.get("serviceDomainCreate")
    if isinstance(dc, list):
        dc = dc[0] if dc else None
    if dc and dc.get("domain"):
        emit("  created " + dc["domain"] + " (targetPort " + str(port) + ")")
        result[name] = "https://" + dc["domain"]
    else:
        emit("  FAILED to create/fix domain")

emit("\nRESULT=" + json.dumps(result))
with open("railway_domains.txt", "w") as f:
    f.write("\n".join(OUT) + "\n")
    f.write("BACKEND_URL=" + result.get("backend", "") + "\n")
    f.write("FRONTEND_URL=" + result.get("frontend", "") + "\n")
