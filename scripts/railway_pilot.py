#!/usr/bin/env python3
"""
End-to-end pilot of the deployed AgentOS backend (runs from a GitHub runner, which can
reach *.up.railway.app). Exercises: health -> create agent -> persistence -> dispatch a
task to Celery -> poll the work log for a result.
"""
import os, json, time
import requests

BASE = os.environ.get("BACKEND_URL", "https://backend-production-a20b.up.railway.app").rstrip("/")
OUT = []


def emit(s):
    print(s, flush=True)
    OUT.append(s)


def show(label, resp):
    body = resp.text
    try:
        body = json.dumps(resp.json())
    except Exception:
        pass
    emit("  " + label + " -> HTTP " + str(resp.status_code) + "  " + body[:400])
    return resp


emit("=== Pilot against " + BASE + " ===")

emit("\n[1] Health")
show("GET /health", requests.get(BASE + "/health", timeout=25))

emit("\n[2] List agents (before)")
r = requests.get(BASE + "/agents/", timeout=25)
before = r.json() if r.status_code == 200 else []
emit("  count before: " + str(len(before)))

emit("\n[3] Create agent")
suffix = str(int(time.time()))
agent_body = {
    "name": "Ada-" + suffix,
    "title": "Research Analyst",
    "department": "Research",
    "bio": "Pilot agent created to validate the live deployment.",
    "avatar_seed": "ada-" + suffix,
    "model": "claude-sonnet-5-20251001",
}
r = show("POST /agents/", requests.post(BASE + "/agents/", json=agent_body, timeout=25))
if r.status_code not in (200, 201):
    emit("  ABORT: could not create agent")
    with open("railway_pilot.txt", "w") as f:
        f.write("\n".join(OUT) + "\nRESULT=CREATE_FAILED\n")
    raise SystemExit(1)
agent = r.json()
agent_id = agent["id"]
emit("  agent_id: " + agent_id)

emit("\n[4] List agents (after) — proves Postgres persistence")
r = requests.get(BASE + "/agents/", timeout=25)
after = r.json() if r.status_code == 200 else []
emit("  count after: " + str(len(after)) + " (was " + str(len(before)) + ")")

emit("\n[5] Get agent by id")
show("GET /agents/{id}", requests.get(BASE + "/agents/" + agent_id, timeout=25))

emit("\n[6] Dispatch a task (queues to Celery via Redis)")
run_body = {"task_type": "research",
            "task_input": {"prompt": "In one sentence, confirm you are an AgentOS agent running live on Railway."},
            "model": "claude-sonnet-5-20251001"}
r = show("POST /agents/{id}/run", requests.post(BASE + "/agents/" + agent_id + "/run", json=run_body, timeout=25))
task_id = r.json().get("task_id") if r.status_code == 200 else None
emit("  task_id: " + str(task_id))

emit("\n[7] Poll work log for a result (up to 150s)")
final_logs = []
for i in range(15):
    time.sleep(10)
    wl = requests.get(BASE + "/work-log/" + agent_id + "?limit=5", timeout=25)
    if wl.status_code == 200:
        logs = wl.json()
        if logs:
            final_logs = logs
            done = [l for l in logs if l.get("finished_at")]
            emit("  poll " + str(i + 1) + ": " + str(len(logs)) + " log(s), finished=" + str(len(done)))
            if done:
                break
        else:
            emit("  poll " + str(i + 1) + ": no work-log yet")
    else:
        emit("  poll " + str(i + 1) + ": HTTP " + str(wl.status_code))

emit("\n[8] Final work log")
if final_logs:
    for l in final_logs[:2]:
        emit("  success=" + str(l.get("success")) + " tokens=" + str(l.get("tokens_used"))
             + " duration_ms=" + str(l.get("duration_ms")))
        emit("  result: " + str(l.get("result"))[:500])
        emit("  reflection: " + str(l.get("reflection"))[:300])
else:
    emit("  (no work-log entry — Celery worker may still be processing or the LLM key is unset/invalid)")

emit("\n[9] Agent after run")
show("GET /agents/{id}", requests.get(BASE + "/agents/" + agent_id, timeout=25))

with open("railway_pilot.txt", "w") as f:
    f.write("\n".join(OUT) + "\nRESULT=DONE\n")
