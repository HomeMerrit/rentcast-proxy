#!/usr/bin/env python3
"""
Smoke-test the new AgentOS backend endpoints against the LIVE deployment
(runs from a GitHub runner, which can reach *.up.railway.app).
Exercises: skills catalog/recommend, company create, document upload+ingest,
agent create (with photo + company), skills add, agent patch, cleanup.
"""
import os, json, io
import requests

BASE = os.environ.get("BACKEND_URL", "https://backend-production-a20b.up.railway.app").rstrip("/")
OUT = []
results = []


def emit(s):
    print(s, flush=True)
    OUT.append(s)


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    emit(("  PASS " if cond else "  FAIL ") + name + ("  " + detail if detail else ""))


emit("=== Smoke test against " + BASE + " ===")

# 1. health
r = requests.get(BASE + "/health", timeout=25)
check("health 200", r.status_code == 200, str(r.status_code))

# 2. skills catalog
r = requests.get(BASE + "/skills/catalog", timeout=25)
cat = r.json() if r.status_code == 200 else {}
depts = cat.get("departments", [])
check("skills catalog", r.status_code == 200 and len(depts) >= 5, f"{len(depts)} departments")

# 3. recommend
r = requests.get(BASE + "/skills/recommend", params={"department": "Research", "title": "Analyst"}, timeout=25)
rec = r.json().get("recommended", []) if r.status_code == 200 else []
check("skills recommend Research", r.status_code == 200 and len(rec) >= 3, f"{len(rec)} skills")

# 4. company create
r = requests.post(BASE + "/company", json={"name": "Smoke Test Co", "industry": "Technology",
                                           "description": "Automated smoke test."}, timeout=25)
company = r.json() if r.status_code in (200, 201) else {}
cid = company.get("id")
check("company create", bool(cid), str(r.status_code))

# 5. document upload + ingest
if cid:
    files = [("files", ("notes.md", io.BytesIO(b"# Playbook\nWe analyze off-market real estate deals. " * 40), "text/markdown"))]
    r = requests.post(BASE + f"/company/{cid}/documents", files=files, timeout=90)
    docs = r.json() if r.status_code in (200, 201) else []
    chunks = docs[0].get("chunk_count", 0) if docs else 0
    check("document upload+ingest", r.status_code in (200, 201) and docs and chunks > 0,
          f"status={r.status_code} chunks={chunks}")

# 6. agent create with photo + company
r = requests.post(BASE + "/agents/", json={
    "name": "Smoke Agent " + str(os.getpid()),
    "title": "QA Specialist",
    "department": "Engineering",
    "bio": "Created by smoke test.",
    "avatar_seed": "smoke",
    "avatar_url": "https://example.com/a.png",
    "company_id": cid,
    "model": "claude-sonnet-5",
}, timeout=25)
agent = r.json() if r.status_code in (200, 201) else {}
aid = agent.get("id")
check("agent create", bool(aid), str(r.status_code))
check("agent has avatar_url", agent.get("avatar_url") == "https://example.com/a.png")
check("agent linked to company", str(agent.get("company_id")) == str(cid))

# 7. add skills
if aid:
    r = requests.post(BASE + f"/agents/{aid}/skills",
                      json={"skills": [{"skill": "Testing", "proficiency": 70}, {"skill": "Debugging", "proficiency": 60}]},
                      timeout=25)
    a2 = r.json() if r.status_code == 200 else {}
    names = {s["skill"] for s in a2.get("skills", [])}
    check("agent add skills", r.status_code == 200 and "Testing" in names and "Debugging" in names,
          f"skills={sorted(names)}")

    # 8. patch agent
    r = requests.patch(BASE + f"/agents/{aid}", json={"title": "Senior QA Specialist"}, timeout=25)
    check("agent patch", r.status_code == 200 and r.json().get("title") == "Senior QA Specialist", str(r.status_code))

    # 9. list company docs
    if cid:
        r = requests.get(BASE + f"/company/{cid}/documents", timeout=25)
        check("company documents list", r.status_code == 200 and isinstance(r.json(), list))

    # 10. cleanup agent
    r = requests.delete(BASE + f"/agents/{aid}", timeout=25)
    check("agent delete", r.status_code == 204, str(r.status_code))

passed = sum(1 for _, ok in results if ok)
emit(f"\n=== {passed}/{len(results)} checks passed ===")
with open("railway_smoke.txt", "w") as f:
    f.write("\n".join(OUT) + f"\nRESULT={'PASS' if passed == len(results) else 'FAIL'} {passed}/{len(results)}\n")
