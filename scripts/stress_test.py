#!/usr/bin/env python3
"""ApeAgents production stress test.

Runs 5 realistic company personas against the live backend: hires real agents,
dispatches real tasks at easy/medium/hard complexity, exercises A2A delegation,
human escalation, SSE streaming, adversarial inputs and a concurrency burst,
then cleans everything up (drain-before-delete) and writes stress_report.json
plus stress_report.md.

Safety rails:
  - every created agent is prefixed ZZ-STRESS- and deleted after its persona
  - agents are only deleted after all their dispatched tasks resolved (a delete
    with an in-flight task would poison the Celery queue with FK errors)
  - dispatching stops if measured spend exceeds SPEND_CAP_USD or the org's
    remaining budget drops below $30 (a shared-org 402 would block the owner)
  - company/document endpoints are never written (no delete endpoints exist)
"""
import concurrent.futures
import json
import os
import sys
import time
import uuid

import requests

BASE = os.environ.get("BACKEND_URL", "https://backend-production-a20b.up.railway.app").rstrip("/")
FRONTEND = os.environ.get("FRONTEND_URL", "https://frontend-production-a9cc3.up.railway.app").rstrip("/")
SPEND_CAP = float(os.environ.get("SPEND_CAP_USD", "10"))
REMAINING_FLOOR = 30.0
RUN_ID = uuid.uuid4().hex[:6]
PREFIX = "ZZ-STRESS"

S = requests.Session()
S.headers["Content-Type"] = "application/json"

REPORT = {
    "run_id": RUN_ID,
    "base_url": BASE,
    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "spend_cap_usd": SPEND_CAP,
    "probes": [],       # discrete pass/fail checks
    "tasks": [],        # every dispatched task with result + timings
    "http_log": [],     # every request: method path status ms
    "billing": {},      # baseline / per-phase snapshots
    "snapshots": {},    # preflight vs final workspace state
    "notes": [],
    "aborted": None,
}

created_agent_ids: dict[str, str] = {}   # id -> name (not yet deleted)
measured_cost = 0.0                       # sum of cost_usd over matched work rows


class StopDispatch(Exception):
    pass


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def flush():
    with open("stress_report.json", "w") as f:
        json.dump(REPORT, f, indent=1, default=str)


def req(method, path, timeout=45, **kw):
    url = path if path.startswith("http") else BASE + path
    t0 = time.time()
    try:
        r = S.request(method, url, timeout=timeout, **kw)
        ms = int((time.time() - t0) * 1000)
        REPORT["http_log"].append({"m": method, "p": path[:80], "s": r.status_code, "ms": ms})
        return r
    except requests.RequestException as e:
        ms = int((time.time() - t0) * 1000)
        REPORT["http_log"].append({"m": method, "p": path[:80], "s": f"EXC:{type(e).__name__}", "ms": ms})
        raise


def probe(pid, area, desc, passed, expected="", actual="", severity=None):
    REPORT["probes"].append({
        "id": pid, "area": area, "desc": desc, "pass": bool(passed),
        "expected": str(expected)[:400], "actual": str(actual)[:400],
        "severity": severity,
    })
    log(f"  probe {pid}: {'PASS' if passed else 'FAIL'} — {desc}")


def note(text):
    REPORT["notes"].append(text)
    log(f"  note: {text}")


def billing():
    r = req("GET", "/billing/usage")
    return r.json() if r.ok else {"error": r.status_code}


def spend_guard():
    b = billing()
    base = REPORT["billing"].get("baseline", {})
    reported_delta = (b.get("spent_usd") or 0) - (base.get("spent_usd") or 0)
    delta = max(reported_delta, measured_cost)
    remaining = b.get("remaining_usd")
    if delta > SPEND_CAP:
        REPORT["aborted"] = f"spend cap: delta ${delta:.2f} > cap ${SPEND_CAP:.2f}"
        raise StopDispatch(REPORT["aborted"])
    if remaining is not None and remaining < REMAINING_FLOOR:
        REPORT["aborted"] = f"org remaining ${remaining:.2f} < floor ${REMAINING_FLOOR:.2f}"
        raise StopDispatch(REPORT["aborted"])


def create_agent(name, title, department, model="claude-sonnet-5", bio=""):
    body = {"name": name, "title": title, "department": department,
            "model": model, "bio": bio, "avatar_seed": name}
    r = req("POST", "/agents/", json=body)
    if r.status_code in (200, 201):
        a = r.json()
        created_agent_ids[a["id"]] = name
        return a
    raise RuntimeError(f"create_agent {name}: {r.status_code} {r.text[:200]}")


def get_agent(agent_id):
    r = req("GET", f"/agents/{agent_id}")
    return r.json() if r.ok else None


def work_rows(agent_id, limit=50):
    r = req("GET", f"/work-log/{agent_id}?limit={limit}")
    return r.json() if r.ok else []


def dispatch(agent_id, task_type, task_input, label, tier, persona, expect_keywords=None):
    nonce = uuid.uuid4().hex
    task_input = dict(task_input)
    task_input["_stress_id"] = nonce
    t0 = time.time()
    r = req("POST", f"/agents/{agent_id}/run",
            json={"task_type": task_type, "task_input": task_input})
    rec = {
        "label": label, "persona": persona, "tier": tier, "agent_id": agent_id,
        "agent_name": created_agent_ids.get(agent_id, "?"), "task_type": task_type,
        "nonce": nonce, "dispatch_status": r.status_code,
        "dispatch_ms": int((time.time() - t0) * 1000),
        "dispatched_at": time.time(), "expect_keywords": expect_keywords or [],
        "outcome": "dispatched",
    }
    REPORT["tasks"].append(rec)
    log(f"  dispatched [{label}] -> {r.status_code}")
    if r.status_code != 200:
        rec["outcome"] = f"dispatch_failed:{r.status_code}"
        rec["dispatch_body"] = r.text[:300]
    return rec


def find_nonce_row(agent_id, nonce):
    for row in work_rows(agent_id):
        ti = row.get("task_input") or {}
        if isinstance(ti, dict) and ti.get("_stress_id") == nonce:
            return row
    return None


def await_task(rec, timeout):
    """Poll for the nonce row; also watch agent status for the error path."""
    if rec["outcome"].startswith("dispatch_failed"):
        return rec
    t0 = time.time()
    error_seen_at = None
    while time.time() - t0 < timeout:
        row = find_nonce_row(rec["agent_id"], rec["nonce"])
        if row:
            global measured_cost
            measured_cost += float(row.get("cost_usd") or 0)
            rec.update({
                "outcome": "finished",
                "wall_s": round(time.time() - rec["dispatched_at"], 1),
                "success": row.get("success"),
                "tokens_used": row.get("tokens_used"),
                "cost_usd": row.get("cost_usd"),
                "duration_ms": row.get("duration_ms"),
                "result_len": len(row.get("result") or ""),
                "result": (row.get("result") or "")[:6000],
                "reflection": (row.get("reflection") or "")[:800],
                "work_log_id": row.get("id"),
            })
            kw = rec.get("expect_keywords") or []
            if kw:
                low = (row.get("result") or "").lower()
                rec["keywords_hit"] = [k for k in kw if k.lower() in low]
                rec["keywords_missed"] = [k for k in kw if k.lower() not in low]
            log(f"  finished [{rec['label']}] in {rec['wall_s']}s "
                f"(tokens={rec['tokens_used']}, cost=${rec['cost_usd']})")
            return rec
        a = get_agent(rec["agent_id"])
        if a and a.get("status") == "error":
            if error_seen_at is None:
                error_seen_at = time.time()
            elif time.time() - error_seen_at > 30:
                rec["outcome"] = "error_status_no_row"
                rec["wall_s"] = round(time.time() - rec["dispatched_at"], 1)
                log(f"  ERROR path [{rec['label']}] after {rec['wall_s']}s")
                return rec
        time.sleep(5)
    rec["outcome"] = "timeout"
    rec["wall_s"] = round(time.time() - rec["dispatched_at"], 1)
    log(f"  TIMEOUT [{rec['label']}] after {timeout}s")
    return rec


def run_and_wait(agent_id, task_type, task_input, label, tier, persona,
                 timeout, expect_keywords=None):
    rec = dispatch(agent_id, task_type, task_input, label, tier, persona, expect_keywords)
    await_task(rec, timeout)
    spend_guard()
    return rec


def drain(agent_ids, timeout=300):
    """Wait until every agent is idle/error and no dispatched nonce is unresolved."""
    t0 = time.time()
    pending = [t for t in REPORT["tasks"]
               if t["agent_id"] in agent_ids and t["outcome"] == "dispatched"]
    while time.time() - t0 < timeout:
        for t in pending[:]:
            if find_nonce_row(t["agent_id"], t["nonce"]):
                t["outcome"] = "finished_late"
                pending.remove(t)
        busy = []
        for aid in agent_ids:
            a = get_agent(aid)
            if a and a.get("status") not in ("idle", "error"):
                busy.append(a.get("status"))
        if not pending and not busy:
            return True
        time.sleep(5)
    note(f"drain timeout: pending={len(pending)} busy={busy}")
    return False


def delete_agents(agent_ids):
    drain(agent_ids)
    for aid in list(agent_ids):
        name = created_agent_ids.get(aid, "?")
        # best-effort memory cleanup first (Qdrant vectors otherwise orphan)
        try:
            r = req("GET", f"/agents/{aid}/memories")
            if r.ok:
                for m in (r.json() or [])[:50]:
                    mid = m.get("id")
                    if mid:
                        req("DELETE", f"/agents/{aid}/memories/{mid}")
        except Exception:
            pass
        r = req("DELETE", f"/agents/{aid}")
        gone = req("GET", f"/agents/{aid}").status_code == 404
        probe(f"cleanup-{name[:40]}", "cleanup", f"delete {name}",
              r.status_code in (200, 204) and gone,
              "delete ok + subsequent GET 404", f"{r.status_code}, gone={gone}")
        created_agent_ids.pop(aid, None)


# ---------------------------------------------------------------- planted docs

LEASE_CLAUSE = """Section 8 — Rent and Deposits. Tenant shall pay monthly rent of
$2,450 due on the first of each month. A grace period of five (5) days applies,
after which a late fee of 5% of the outstanding amount is assessed. Tenant has
paid a security deposit of $3,675, refundable within 21 days of move-out less
documented damages. Landlord may raise rent no more than once per twelve-month
period and only with sixty (60) days written notice."""

MEETING_NOTES = """Weekly growth sync — attendees: Ana, Priya, Tom, Jordan.
Ana: trial-to-paid conversion dropped from 18% to 14% after the pricing page
redesign. ACTION: Tom to roll back the pricing page hero copy by Friday.
Priya: enterprise churn is concentrated in accounts without an onboarding call.
ACTION: Jordan to schedule onboarding calls for all Q3 enterprise signups.
Tom: the new referral program drove 212 signups, CAC down 22%.
ACTION: Ana to double the referral reward budget for one more month.
Jordan: SOC 2 audit fieldwork starts on the 14th. ACTION: Priya to own the
evidence collection checklist and report blockers on Monday."""

SALES_CSV = """month,channel,revenue_usd,orders
2026-01,Instagram Ads,42100,530
2026-01,Google Shopping,38800,410
2026-01,TikTok Shop,9800,140
2026-02,Instagram Ads,43000,545
2026-02,Google Shopping,37200,395
2026-02,TikTok Shop,18400,262
2026-03,Instagram Ads,41800,538
2026-03,Google Shopping,36900,388
2026-03,TikTok Shop,31500,447
2026-04,Instagram Ads,42600,542
2026-04,Google Shopping,35100,371
2026-04,TikTok Shop,52300,741
2026-05,Instagram Ads,43900,551
2026-05,Google Shopping,34000,360
2026-05,TikTok Shop,79800,1122
2026-06,Instagram Ads,44100,555
2026-06,Google Shopping,33200,349
2026-06,TikTok Shop,110900,1540"""

CONTRACT_PARA = """Limitation and Indemnity. Supplier shall indemnify Client for
third-party IP claims up to an aggregate cap of $250,000. Either party may
terminate for material breach only after providing written notice and a
sixty (60) day cure period. Neither party is liable for consequential damages
except in cases of gross negligence or willful misconduct."""


def build_long_contracts(target_kb=45):
    """Three synthetic MSAs with planted conflicts for the long-input hard task."""
    filler = ("The parties acknowledge that the provision of Services shall at all "
              "times conform to generally accepted professional standards and all "
              "applicable laws, rules and regulations in effect during the Term. ")
    docs = []
    plants = [
        ("ACME MASTER SERVICES AGREEMENT (Document A)",
         "Payment terms: all undisputed invoices are due net-30 from receipt.",
         "Termination for convenience requires thirty (30) days prior written notice.",
         "Aggregate liability is capped at $100,000."),
        ("ACME STATEMENT OF WORK RIDER (Document B)",
         "Payment terms: all invoices are due net-45 from the invoice date.",
         "Termination for convenience requires ninety (90) days prior written notice.",
         "Aggregate liability is capped at $1,000,000."),
        ("ACME DATA PROCESSING ADDENDUM (Document C)",
         "Payment obligations follow the Master Services Agreement.",
         "Either party may terminate immediately upon a data protection breach.",
         "Liability for data incidents is uncapped."),
    ]
    for title, pay, term, liab in plants:
        body = [title, ""]
        for i in range(1, 60):
            body.append(f"Section {i}. " + filler * 3)
            if i == 12:
                body.append("Section 12a (KEY TERM). " + pay)
            if i == 24:
                body.append("Section 24a (KEY TERM). " + term)
            if i == 36:
                body.append("Section 36a (KEY TERM). " + liab)
        docs.append("\n".join(body))
    text = "\n\n=====\n\n".join(docs)
    return text[: target_kb * 1024]


# ---------------------------------------------------------------- phases

def phase0_preflight():
    log("phase 0: preflight")
    r = req("GET", "/health")
    probe("pre-health", "reliability", "backend /health reachable", r.ok, 200, r.status_code,
          None if r.ok else "P0")
    if not r.ok:
        raise StopDispatch("backend unreachable")
    REPORT["snapshots"]["health"] = r.json()

    b = billing()
    REPORT["billing"]["baseline"] = b
    log(f"  billing baseline: spent=${b.get('spent_usd')} remaining=${b.get('remaining_usd')}")
    if b.get("over_budget") or (b.get("remaining_usd") is not None
                                and b["remaining_usd"] < REMAINING_FLOOR):
        raise StopDispatch(f"insufficient budget headroom: {b}")

    agents = req("GET", "/agents/").json()
    REPORT["snapshots"]["pre_agents"] = [
        {"id": a["id"], "name": a["name"], "status": a.get("status")} for a in agents]
    leftovers = [a for a in agents if a["name"].startswith(PREFIX)]
    if leftovers:
        note(f"deleting {len(leftovers)} leftover {PREFIX} agents from a prior run")
        for a in leftovers:
            created_agent_ids[a["id"]] = a["name"]
        delete_agents([a["id"] for a in leftovers])

    ov = req("GET", "/stats/overview")
    REPORT["snapshots"]["pre_overview"] = ov.json() if ov.ok else {"error": ov.status_code}
    comp = req("GET", "/company")
    REPORT["snapshots"]["pre_company"] = comp.json() if comp.ok else {"error": comp.status_code}

    fr = req("GET", FRONTEND + "/", timeout=30)
    probe("pre-frontend", "reliability", "frontend serves 200", fr.ok, 200, fr.status_code,
          None if fr.ok else "P0")
    flush()


def phase1_adversarial():
    log("phase 1: adversarial probes")
    # signup flow (permanent org row; one probe only)
    r = req("POST", "/auth/signup", json={
        "org_name": f"{PREFIX}-Org-{RUN_ID}",
        "email": f"zz-stress-{RUN_ID}@example.com", "name": "Stress Bot"})
    ok = r.status_code in (200, 201) and bool(r.ok and r.json().get("key"))
    probe("adv-signup", "auth", "signup returns a one-time API key", ok,
          "200 + key", f"{r.status_code}", None if ok else "P1")
    if ok:
        note("signup created a permanent org row (no org delete endpoint) — "
             "residue invisible to the default workspace")

    a1 = create_agent(f"{PREFIX}-ADV-Dup-{RUN_ID}", "Probe", "Operations",
                      model="claude-haiku-4-5-20251001")
    r = req("POST", "/agents/", json={
        "name": a1["name"], "title": "Probe", "department": "Operations",
        "avatar_seed": "x"})
    probe("adv-dup-name", "validation", "duplicate agent name rejected",
          r.status_code == 409, 409, r.status_code, None if r.status_code == 409 else "P2")

    # unvalidated model string: creation succeeds, run must fail in the worker
    bad = create_agent(f"{PREFIX}-ADV-BadModel-{RUN_ID}", "Probe", "Operations",
                       model="not-a-real-model")
    rec = dispatch(bad["id"], "write", {"what": "Reply with the single word OK."},
                   "adv-bad-model-run", "probe", "adversarial")
    await_task(rec, 180)
    err_path = rec["outcome"] in ("error_status_no_row", "timeout")
    probe("adv-bad-model", "validation",
          "invalid model accepted at create; run fails silently with no work-log row",
          err_path, "agent status=error, no row, $0 recorded",
          rec["outcome"], "P1")

    # free-form task_type
    a2 = create_agent(f"{PREFIX}-ADV-Type-{RUN_ID}", "Probe", "Operations",
                      model="claude-haiku-4-5-20251001")
    rec = run_and_wait(a2["id"], "totally_made_up_type",
                       {"instructions": "Reply with the single word OK."},
                       "adv-free-tasktype", "probe", "adversarial", 240)
    probe("adv-free-tasktype", "validation",
          "unknown task_type accepted and executed (no allowlist)",
          rec["outcome"] == "finished", "executes normally", rec["outcome"], "P2")

    # unbounded field lengths
    r = req("POST", "/agents/", json={
        "name": f"{PREFIX}-ADV-Big-{RUN_ID}-" + "x" * 10000,
        "title": "y" * 10000, "department": "Operations", "avatar_seed": "z"})
    big_ok = r.status_code in (200, 201)
    probe("adv-big-fields", "validation", "10KB name/title accepted?",
          True, "recorded", f"status={r.status_code}", "P2" if big_ok else None)
    if big_ok:
        created_agent_ids[r.json()["id"]] = r.json()["name"]
        delete_agents([r.json()["id"]])

    # empty name
    r = req("POST", "/agents/", json={"name": "", "title": "t",
                                      "department": "Operations", "avatar_seed": "z"})
    if r.status_code in (200, 201):
        created_agent_ids[r.json()["id"]] = r.json()["name"] or "(empty)"
        probe("adv-empty-name", "validation", "empty agent name accepted",
              False, "422", r.status_code, "P2")
        delete_agents([r.json()["id"]])
    else:
        probe("adv-empty-name", "validation", "empty agent name rejected",
              True, "4xx", r.status_code)

    # bogus ids
    r = req("GET", f"/agents/{uuid.uuid4()}")
    probe("adv-404", "validation", "unknown agent id -> 404", r.status_code == 404,
          404, r.status_code, None if r.status_code == 404 else "P2")
    r = req("GET", "/agents/not-a-uuid")
    probe("adv-bad-uuid", "validation", "malformed uuid -> 422",
          r.status_code in (404, 422), "422/404", r.status_code,
          None if r.status_code in (404, 422) else "P2")

    # SSE lifecycle on a trivial run
    sse_agent = a2
    events = []
    rec = dispatch(sse_agent["id"], "write", {"what": "Reply with the single word OK."},
                   "adv-sse-run", "probe", "adversarial")
    try:
        with S.get(BASE + "/stream/fleet", stream=True, timeout=(10, 130)) as resp:
            t0 = time.time()
            for line in resp.iter_lines(decode_unicode=True):
                if time.time() - t0 > 120:
                    break
                if line and line.startswith("data: "):
                    try:
                        ev = json.loads(line[6:])
                    except ValueError:
                        continue
                    if ev.get("agent_id") in (sse_agent["id"], None):
                        events.append(ev.get("type"))
                    if ev.get("type") in ("RUN_FINISHED", "RUN_ERROR") \
                            and ev.get("agent_id") == sse_agent["id"]:
                        break
    except requests.RequestException as e:
        events.append(f"EXC:{type(e).__name__}")
    REPORT.setdefault("sse_events", events)
    lifecycle_ok = "CONNECTED" in events and "RUN_STARTED" in events \
        and "RUN_FINISHED" in events
    probe("adv-sse", "streaming", "SSE fleet stream delivers run lifecycle",
          lifecycle_ok, "CONNECTED..RUN_STARTED..RUN_FINISHED",
          ",".join(map(str, events[:20])), None if lifecycle_ok else "P1")
    await_task(rec, 180)

    delete_agents([a1["id"], bad["id"], a2["id"]])
    REPORT["billing"]["after_phase1"] = billing()
    flush()


PERSONA_DEFS = [
    {
        "name": "Summit Ridge Realty",
        "desc": "real-estate investment firm",
        "agents": {
            "analyst": ("P1-Analyst", "Acquisitions Research Analyst", "Research",
                        "claude-sonnet-5"),
            "coord": ("P1-Coordinator", "Operations Coordinator", "Operations",
                      "claude-haiku-4-5-20251001"),
        },
    },
    {
        "name": "Brightcart",
        "desc": "DTC e-commerce brand",
        "agents": {
            "copy": ("P2-Copywriter", "Senior Copywriter", "Marketing",
                     "claude-haiku-4-5-20251001"),
            "growth": ("P2-Growth", "Growth Analyst", "Data", "claude-sonnet-5"),
        },
    },
    {
        "name": "Loop Metrics",
        "desc": "B2B SaaS analytics startup",
        "agents": {
            "data": ("P3-DataAnalyst", "Product Data Analyst", "Data", "claude-sonnet-5"),
            "research": ("P3-Researcher", "Competitive Researcher", "Research",
                         "claude-sonnet-5"),
        },
    },
    {
        "name": "Harbor & Vane",
        "desc": "boutique marketing agency",
        "agents": {
            "strategist": ("P4-Strategist", "Brand Strategist", "Marketing",
                           "claude-opus-4-8"),
            "copy": ("P4-Copywriter", "Copywriter", "Marketing",
                     "claude-haiku-4-5-20251001"),
            "brief": ("P4-BriefWriter", "Design Brief Writer", "Design",
                      "claude-sonnet-5"),
        },
    },
    {
        "name": "Caldwell Legal",
        "desc": "small law firm",
        "agents": {
            "contracts": ("P5-Contracts", "Contracts Analyst", "Legal", "claude-sonnet-5"),
            "paralegal": ("P5-Paralegal", "Paralegal", "Legal",
                          "claude-haiku-4-5-20251001"),
        },
    },
]


def await_a2a_child(target_id, since_ts, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        for row in work_rows(target_id):
            if row.get("task_type") == "a2a_task":
                started = row.get("started_at") or ""
                return row
        time.sleep(5)
    return None


def run_persona(pdef, idx):
    pname = pdef["name"]
    log(f"phase 2.{idx}: persona {pname}")
    agents = {}
    for key, (suffix, title, dept, model) in pdef["agents"].items():
        agents[key] = create_agent(
            f"{PREFIX}-{suffix}-{RUN_ID}", title, dept, model=model,
            bio=f"Works at {pname}, a {pdef['desc']}.")
        # exercise the skills endpoint the create studio uses
        req("POST", f"/agents/{agents[key]['id']}/skills",
            json=[{"skill": "communication", "proficiency": 60}])
    result = {"persona": pname, "agents": {k: a["id"] for k, a in agents.items()}}

    if pname == "Summit Ridge Realty":
        run_and_wait(agents["analyst"]["id"], "summarize",
                     {"content": LEASE_CLAUSE},
                     "p1-easy-lease-summary", "easy", pname, 240,
                     expect_keywords=["2,450", "5%", "21"])
        run_and_wait(agents["analyst"]["id"], "plan",
                     {"goal": "Build a rental market analysis plan for the Denver metro "
                              "to guide our next duplex acquisitions.",
                      "constraints": "Two-week timeline, one analyst, public data only."},
                     "p1-medium-market-plan", "medium", pname, 420,
                     expect_keywords=["denver"])
        rec = run_and_wait(
            agents["coord"]["id"], "custom",
            {"instructions":
                "Step 1: You MUST use the browse_web tool to visit https://example.com "
                "and note the page's main heading text exactly. "
                f"Step 2: You MUST use the send_to_agent tool to delegate to the agent "
                f"named '{agents['analyst']['name']}' this task: 'Write two sentences on "
                "what a placeholder domain is, referencing the heading I found.' "
                "Then summarize what you found and what you delegated."},
            "p1-hard-browse-delegate", "hard", pname, 600,
            expect_keywords=["example domain"])
        child = await_a2a_child(agents["analyst"]["id"], rec["dispatched_at"])
        probe("p1-a2a-child", "a2a", "delegated a2a_task ran on the analyst",
              child is not None, "a2a_task work row on target",
              (child or {}).get("task_type", "none"), None if child else "P1")
        comms = req("GET", f"/comms/{agents['coord']['id']}")
        has_task_comm = comms.ok and any(
            c.get("message_type") == "task" for c in comms.json())
        probe("p1-a2a-comm", "a2a", "A2A message recorded in comms",
              has_task_comm, "message_type=task row", comms.status_code,
              None if has_task_comm else "P2")

    elif pname == "Brightcart":
        run_and_wait(agents["copy"]["id"], "write",
                     {"what": "A product description for the AscendDesk Pro, a bamboo "
                              "standing desk with dual motors and a 15-year warranty.",
                      "notes": "Warm, concrete, no hype words. Mention bamboo and the "
                               "warranty. Under 120 words."},
                     "p2-easy-product-desc", "easy", pname, 240,
                     expect_keywords=["bamboo", "warranty"])
        run_and_wait(agents["growth"]["id"], "analyze",
                     {"subject": "Six months of channel revenue:\n" + SALES_CSV,
                      "question": "Which channel is growing fastest and what should we "
                                  "do about budget allocation?"},
                     "p2-medium-csv-analysis", "medium", pname, 420,
                     expect_keywords=["tiktok"])
        rec = run_and_wait(
            agents["growth"]["id"], "plan",
            {"goal": "A 4-week launch plan for our new AscendDesk Pro colorway.",
             "constraints":
                f"You MUST use the send_to_agent tool to delegate to the agent named "
                f"'{agents['copy']['name']}' the writing of three launch taglines as "
                "part of this plan. Include the delegation in your plan."},
            "p2-hard-plan-delegate", "hard", pname, 600)
        child = await_a2a_child(agents["copy"]["id"], rec["dispatched_at"])
        probe("p2-a2a-child", "a2a", "delegated tagline task ran on the copywriter",
              child is not None, "a2a_task row", (child or {}).get("task_type", "none"),
              None if child else "P1")

    elif pname == "Loop Metrics":
        run_and_wait(agents["data"]["id"], "summarize",
                     {"content": MEETING_NOTES},
                     "p3-easy-notes-summary", "easy", pname, 240,
                     expect_keywords=["pricing", "churn", "referral", "SOC 2"])
        run_and_wait(agents["research"]["id"], "research",
                     {"topic": "What is currently on the Hacker News front page?",
                      "focus": "You MUST use the browse_web tool to visit "
                               "https://news.ycombinator.com and list the top five "
                               "story titles you actually see."},
                     "p3-medium-browse-research", "medium", pname, 420)
        run_and_wait(agents["data"]["id"], "analyze",
                     {"subject": "The monthly churn counts [12, 19, 23, 8, 30, 27].",
                      "question": "You MUST use the execute_python tool to compute the "
                                  "mean and sample standard deviation, then interpret."},
                     "p3-hard-python", "hard", pname, 600,
                     expect_keywords=["19.8"])
    elif pname == "Harbor & Vane":
        run_and_wait(agents["copy"]["id"], "outreach",
                     {"audience": "Owners of boutique hotels in coastal towns",
                      "goal": "Book a 30-minute brand audit call"},
                     "p4-easy-outreach", "easy", pname, 240,
                     expect_keywords=["hotel"])
        run_and_wait(agents["brief"]["id"], "write",
                     {"what": "A one-page design brief for rebranding a family-owned "
                              "olive oil producer entering the US market.",
                      "notes": "Include audience, tone, deliverables, and two references."},
                     "p4-easy2-brief", "easy", pname, 240)
        run_and_wait(agents["strategist"]["id"], "plan",
                     {"goal": "A 90-day content strategy for the olive oil rebrand.",
                      "constraints": "Two channels max, one writer, $2k/month paid budget."},
                     "p4-medium-strategy", "medium", pname, 420)
        rec = run_and_wait(
            agents["strategist"]["id"], "custom",
            {"instructions":
                f"You MUST use the send_to_agent tool to delegate to the agent named "
                f"'{agents['copy']['name']}' this task: 'Write three taglines for an "
                "olive oil brand: one heritage-led, one health-led, one chef-led.' "
                "After delegating, briefly explain your creative direction."},
            "p4-hard-pipeline", "hard", pname, 600)
        child = await_a2a_child(agents["copy"]["id"], rec["dispatched_at"])
        probe("p4-a2a-child", "a2a", "strategist->copywriter delegation ran",
              child is not None, "a2a_task row", (child or {}).get("task_type", "none"),
              None if child else "P1")
        net = req("GET", "/stats/network")
        edge = False
        if net.ok:
            blob = json.dumps(net.json())
            edge = (agents["strategist"]["name"] in blob
                    and agents["copy"]["name"] in blob)
        probe("p4-network-edge", "a2a", "/stats/network reflects the hand-off",
              edge, "edge or recent entry present", net.status_code,
              None if edge else "P2")

    elif pname == "Caldwell Legal":
        run_and_wait(agents["contracts"]["id"], "summarize",
                     {"content": CONTRACT_PARA},
                     "p5-easy-clause", "easy", pname, 240,
                     expect_keywords=["250,000", "60"])
        rec = run_and_wait(
            agents["paralegal"]["id"], "custom",
            {"instructions":
                "You MUST use the notify_human tool with urgency='high' to ask your "
                "human supervisor: 'Should we accept the counterparty's revised "
                "limitation of liability at 2x fees?' Then state that you are waiting "
                "for their answer."},
            "p5-medium-escalation", "medium", pname, 420)
        inbox = req("GET", "/comms/human-inbox")
        ours = []
        if inbox.ok:
            ours = [m for m in inbox.json()
                    if m.get("from_agent_name") == agents["paralegal"]["name"]]
        probe("p5-notify-human", "hitl", "notify_human landed in the human inbox",
              bool(ours), ">=1 inbox message from paralegal", len(ours),
              None if ours else "P1")
        if ours:
            cnt = req("GET", "/comms/human-inbox/count")
            probe("p5-unread-count", "hitl", "unread count endpoint reflects it",
                  cnt.ok and cnt.json().get("unread", 0) >= 1, ">=1",
                  cnt.json() if cnt.ok else cnt.status_code)
            mid = ours[0]["id"]
            rr = req("POST", f"/comms/{mid}/reply",
                     json={"message": "Yes — accept 2x fees, but require the carve-out "
                                      "for confidentiality breaches. (stress-test reply)"})
            probe("p5-human-reply", "hitl", "human reply endpoint works",
                  rr.ok, "2xx", rr.status_code, None if rr.ok else "P1")
            rd = req("PATCH", f"/comms/{mid}/read")
            probe("p5-mark-read", "hitl", "mark-read works", rd.ok, "2xx", rd.status_code)
        run_and_wait(agents["contracts"]["id"], "analyze",
                     {"subject": build_long_contracts(),
                      "question": "Identify every conflicting KEY TERM across the three "
                                  "documents (payment, termination, liability) and state "
                                  "which document says what."},
                     "p5-hard-long-input", "hard", pname, 600,
                     expect_keywords=["net-30", "net-45", "90", "100,000", "1,000,000"])

    # per-persona health checks
    some_agent = list(agents.values())[0]
    ev = req("GET", f"/agents/{some_agent['id']}/evals")
    REPORT.setdefault("evals_samples", []).append(
        {"persona": pname, "status": ev.status_code,
         "body": (ev.json() if ev.ok else None)})
    mem = req("GET", f"/agents/{some_agent['id']}/memories")
    mem_count = len(mem.json()) if mem.ok and isinstance(mem.json(), list) else 0
    probe(f"p{idx}-memories", "memory", f"{pname}: episodic memories written",
          mem_count > 0, ">0 memories after tasks", mem_count,
          None if mem_count else "P2")

    REPORT["billing"][f"after_{pname}"] = billing()
    delete_agents([a["id"] for a in agents.values()])
    flush()
    return result


def phase3_burst():
    log("phase 3: concurrency burst")
    a = create_agent(f"{PREFIX}-Burst-{RUN_ID}", "Burst Probe", "Operations",
                     model="claude-haiku-4-5-20251001")
    recs = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        futs = [ex.submit(dispatch, a["id"], "write",
                          {"what": f"Reply with the single word OK. (burst {i})"},
                          f"burst-{i}", "burst", "burst") for i in range(5)]
        recs = [f.result() for f in futs]
    lat = sorted(r["dispatch_ms"] for r in recs)
    t0 = time.time()
    while time.time() - t0 < 420:
        done = [r for r in recs if find_nonce_row(a["id"], r["nonce"])]
        if len(done) == 5:
            break
        time.sleep(6)
    rows = work_rows(a["id"])
    matched = [r for r in recs if find_nonce_row(a["id"], r["nonce"])]
    for r in recs:
        row = find_nonce_row(a["id"], r["nonce"])
        if row:
            r["outcome"] = "finished"
            r["wall_s"] = round(time.time() - r["dispatched_at"], 1)
            global measured_cost
            measured_cost += float(row.get("cost_usd") or 0)
    probe("burst-complete", "reliability", "5 concurrent dispatches all completed",
          len(matched) == 5, 5, len(matched), None if len(matched) == 5 else "P1")
    agent_now = get_agent(a["id"]) or {}
    probe("burst-count-race", "reliability",
          "task_count matches work-log rows (read-modify-write race check)",
          agent_now.get("task_count") == len(rows),
          f"task_count == {len(rows)}", agent_now.get("task_count"),
          None if agent_now.get("task_count") == len(rows) else "P2")
    REPORT["burst"] = {"dispatch_ms_sorted": lat, "completed": len(matched),
                       "rows": len(rows), "task_count": agent_now.get("task_count")}
    delete_agents([a["id"]])
    flush()


def phase4_sweeps_and_diff():
    log("phase 4: read-only sweeps and final diff")
    for path in ("/stats/overview", "/stats/agents", "/stats/activity?limit=30",
                 "/stats/timeseries?days=14", "/stats/network",
                 "/.well-known/agent-card.json"):
        r = req("GET", path)
        probe(f"sweep{path}", "reliability", f"GET {path}", r.ok, 200, r.status_code,
              None if r.ok else "P2")
    REPORT["billing"]["pre_cleanup_final"] = billing()
    # (persona agents are already deleted; this is the post-cleanup reading)
    REPORT["billing"]["post_cleanup"] = REPORT["billing"]["pre_cleanup_final"]

    agents = req("GET", "/agents/").json()
    REPORT["snapshots"]["post_agents"] = [
        {"id": a["id"], "name": a["name"], "status": a.get("status")} for a in agents]
    leftover = [a["name"] for a in agents if a["name"].startswith(PREFIX)]
    probe("final-clean", "cleanup", "no ZZ-STRESS agents remain",
          not leftover, "[]", leftover, None if not leftover else "P1")
    pre = {a["id"] for a in REPORT["snapshots"]["pre_agents"]}
    post = {a["id"] for a in REPORT["snapshots"]["post_agents"]}
    probe("final-workspace-restored", "cleanup",
          "workspace agent set identical to preflight", pre == post,
          "identical", f"added={post-pre} removed={pre-post}",
          None if pre == post else "P1")
    ov = req("GET", "/stats/overview")
    REPORT["snapshots"]["post_overview"] = ov.json() if ov.ok else {}
    flush()


def write_md():
    p = REPORT
    lines = [f"# Stress test report — run {p['run_id']}",
             f"Backend: {p['base_url']}  |  started {p['started_at']}  |  "
             f"aborted: {p['aborted']}", ""]
    b0 = p["billing"].get("baseline", {})
    b1 = p["billing"].get("pre_cleanup_final", {})
    lines += [f"Billing: baseline spent ${b0.get('spent_usd')} → final reported "
              f"${b1.get('spent_usd')} (measured task cost ${measured_cost:.4f}; "
              f"reported spend self-reverts when test agents are deleted)", ""]
    lines.append("## Tasks")
    lines.append("| label | tier | outcome | wall s | tokens | cost $ | keywords hit |")
    lines.append("|---|---|---|---|---|---|---|")
    for t in p["tasks"]:
        kw = f"{len(t.get('keywords_hit', []))}/{len(t.get('expect_keywords', []))}" \
            if t.get("expect_keywords") else "-"
        lines.append(f"| {t['label']} | {t['tier']} | {t['outcome']} | "
                     f"{t.get('wall_s', '-')} | {t.get('tokens_used', '-')} | "
                     f"{t.get('cost_usd', '-')} | {kw} |")
    lines += ["", "## Probes"]
    lines.append("| id | area | pass | severity | actual |")
    lines.append("|---|---|---|---|---|")
    for pr in p["probes"]:
        lines.append(f"| {pr['id']} | {pr['area']} | "
                     f"{'PASS' if pr['pass'] else 'FAIL'} | {pr['severity'] or ''} | "
                     f"{pr['actual'][:80]} |")
    lat = sorted(h["ms"] for h in p["http_log"] if isinstance(h["s"], int))
    if lat:
        p50 = lat[len(lat) // 2]
        p95 = lat[int(len(lat) * 0.95) - 1]
        lines += ["", f"HTTP calls: {len(lat)}, p50 {p50}ms, p95 {p95}ms"]
    if p["notes"]:
        lines += ["", "## Notes"] + [f"- {n}" for n in p["notes"]]
    with open("stress_report.md", "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    exit_code = 0
    try:
        phase0_preflight()
        phase1_adversarial()
        for i, pdef in enumerate(PERSONA_DEFS, 1):
            run_persona(pdef, i)
        phase3_burst()
    except StopDispatch as e:
        log(f"DISPATCH STOPPED: {e}")
        REPORT["aborted"] = REPORT["aborted"] or str(e)
        exit_code = 0  # a guarded stop is still a valid (partial) run
    except Exception as e:  # noqa: BLE001 — report the crash, still clean up
        import traceback
        REPORT["aborted"] = f"crash: {e}"
        REPORT["crash_trace"] = traceback.format_exc()[-3000:]
        log(f"CRASH: {e}")
        exit_code = 1
    finally:
        try:
            if created_agent_ids:
                log(f"final cleanup of {len(created_agent_ids)} agents")
                delete_agents(list(created_agent_ids))
        except Exception as e:  # noqa: BLE001
            note(f"cleanup error: {e}")
        try:
            phase4_sweeps_and_diff()
        except Exception as e:  # noqa: BLE001
            note(f"phase4 error: {e}")
        REPORT["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        REPORT["measured_cost_usd"] = round(measured_cost, 4)
        flush()
        write_md()
        log(f"done — measured task cost ${measured_cost:.4f}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
