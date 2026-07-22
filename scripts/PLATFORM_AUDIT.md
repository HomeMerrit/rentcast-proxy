# ApeAgents Platform Audit — Full-Stack Stress Test & Graded Report

**Date:** 2026-07-22 · **Run ID:** `5fcffe` (API) / `h7wbko` (prod UI) · **Real spend:** $0.66 · **Requests:** 608 · **Test agents:** 17 created, 17 deleted, workspace restored to exactly its pre-test state (0 agents before, 0 after).

Three tiers were executed: **Tier 1** — exhaustive local UI/UX audit in demo mode (22 page audits desktop+mobile, 12 interactive flows, 25+ screenshots); **Tier 2** — real E2E stress test against the production backend via GitHub Actions (5 company personas × easy/medium/hard tasks, adversarial probes, 5-way burst, SSE, billing, cleanup verification); **Tier 3** — real browser journey on the production site. Raw data: `scripts/stress_results/` (JSON + markdown + screenshots), Tier-1 data in session scratchpad.

---

## Executive summary — Overall grade: **C−**

ApeAgents demos beautifully and its infrastructure is genuinely solid — p50 latency 113 ms across 608 production calls, a 5-way concurrent burst completed with zero races, and every create/delete cycle was clean. But the platform is currently **two separate products that don't touch**:

1. **The production website is a movie set.** The deployed frontend was built without `NEXT_PUBLIC_API_URL`, so `DEMO = true` is baked into the bundle (`src/lib/demo.ts:8`). Every visitor — including a paying customer — sees the fabricated demo fleet (Maya Chen, Ravi Menon, …) with a "Streaming" pill, and every hire/job they perform is faked client-side and never reaches the backend. Verified: prod `/live` renders demo seeds while the real org contained zero agents; a UI-hired agent produced no backend row in 180 s.

2. **The real backend can't use its own tools.** In `BaseAgent._think`, streamed `tool_call_chunks` are collected into a local variable that is never used, and the final message is built from `last_chunk.tool_calls` — which is empty (`base_agent.py:190-203`). **No tool has ever executed in production**: not `send_to_agent` (A2A), not `notify_human` (human inbox), not `browse_web`, not `execute_python`. Compounding it, the System/Human task messages are never persisted into graph state (`base_agent.py:151-155`), so whenever the model goes tool-first, the run ends with an **empty result that is still billed and logged as finished work** — 5 of 16 persona tasks (31%) came back empty, with reflections literally saying *"no task has been given to me yet."* The LLM judge honestly scored these 15/100.

The good news: both P0s are small, surgical fixes (a Dockerfile `ARG` + ~20 lines in one method), and the stress harness that found them is now a repeatable workflow — fix, re-dispatch, and watch the same probes go green.

---

## Per-area grades

| Area | Grade | Evidence |
|---|---|---|
| Visual polish & brand | **A−** | Landing, HQ 3D scene, clay design system are genuinely distinctive (screenshots in `stress_results/shots/`). No console errors anywhere on prod or local. |
| Performance & reliability | **A−** | 608 prod calls: p50 113 ms, p95 154 ms, max 434 ms. Burst of 5 concurrent runs: all completed, `task_count == work_log` rows (no read-modify-write race). Zero 5xx. |
| Agent creation UX | **B+** | Hire gated until required fields, skills recommended per department, mint reveal fires (local flow + prod UI). Gap: after hire the user stays on `/agents/new` — no route to the new agent's profile or first job. |
| First-run & onboarding | **B** | Both onboarding paths advance; empty business name gives feedback. Demo mode is not labeled anywhere — a first-run user cannot tell the data is fake (compounds P0-1). |
| Growth / evals / leveling | **B−** | Eval judge works end-to-end, writes scores + skill deltas, and is honest (scored the broken runs 15/100). But judge exceptions silently score 50, and judge/evolution spend is unbilled. |
| Error handling & validation | **C−** | Good: dup name → 409, bad UUID → 422, clean 404s. Bad: empty agent name → 201, 10 KB name → 201, unknown `task_type` executes and bills, invalid `model` accepted at create then fails invisibly (42 s of silent retries, no work row, no user-facing error, $0 recorded). |
| Mobile & responsive | **C−** | Horizontal overflow on `/`, `/live`, `/network` — **both** mobile (390 px spill) and desktop (448 px spill at 1440 px), local and prod. `/live` has 18 sub-32px tap targets on mobile. |
| Live / streaming UX | **C−** | SSE infrastructure works (token deltas stream, state snapshots publish). But the fleet-stream probe never saw `RUN_STARTED`/`RUN_FINISHED` for its run window, a `RUN_ERROR` from an unrelated agent leaked in, and prod `/live` streams fake data (P0-1). |
| Task execution quality | **D** | Easy text-only tasks are good (lease summary 3/3 keyword facts, meeting notes 4/4; the $0.22 Opus strategy doc was genuinely strong, and the long-input contract analysis correctly flagged truncated input). But 5/16 tasks returned empty, and every task requiring a tool failed — hard tier is effectively 0% functional. |
| Results surfacing | **D** | Work-log API returns results and the profile Work-history tab exists — but on the live site users can never see a real result (P0-1), and failed runs write no row at all, so failures are invisible everywhere. |
| Human-in-the-loop comms | **D** | Inbox API + drawer UI both work (reply/mark-read exercised in demo). But `notify_human` never executes (P0-2), so nothing real can ever arrive: end-to-end escalation is 0-for-1. |
| Cost controls & billing | **D+** | Budget guard works and `/billing/usage` is live. But the ledger is computed from work_log rows, so **deleting an agent reverts its recorded spend** — mid-campaign the org's reported spend went $0.34 → $0.17 → $0.00 while real Anthropic spend was $0.66. Failed runs bill $0 despite real API spend. |
| Security & tenancy posture | **D** | `REQUIRE_AUTH=false` in prod: every request (even with an API key) resolves to the shared default org (`app/tenancy.py:65`). Signup happily issues keys that isolate nothing, and creates permanent org rows (no delete endpoint). The tenancy code exists and is tested — it is simply switched off. |

---

## Bug list

### P0 — blockers (the product does not function end-to-end)

| # | Bug | Evidence | Root cause |
|---|---|---|---|
| P0-1 | **Production frontend runs entirely on fabricated demo data.** Real users see fake agents; their hires/jobs are silently no-ops. | Prod `/live` shows demo seeds (`prod-live-during.png`) while backend org has 0 agents; prod home prefetches `/agents/agent-maya`; UI-hired agent absent from backend after 180 s. | `frontend/Dockerfile` declares no `ARG NEXT_PUBLIC_API_URL`, so `next build` inlines `DEMO = !process.env.NEXT_PUBLIC_API_URL` → `true` (`src/lib/demo.ts:8`). The Railway variable set by `scripts/deploy_railway.py:415` never reaches the build. |
| P0-2 | **Agent tools never execute.** A2A delegation, `notify_human`, `browse_web`, `execute_python` are all dead in real runs — models say "I'll use the tool…" and stop. | 0/3 A2A probes produced a child task; human inbox 0 messages after explicit escalation task; judge: "did not actually use the send_to_agent tool, only stated intent." | `base_agent.py:190-203` — streamed `tool_call_chunks` accumulated into a local var that is never used; final `AIMessage` takes `last_chunk.tool_calls` (empty fragment), so `_should_use_tools` never routes to the tools node. |
| P0-3 | **Task context lost mid-run → empty results billed as finished work.** 5/16 persona tasks (31%) returned "" with `success=false`, yet consumed 1.3–2.7 k tokens each, wrote work-log rows, and appear as completed jobs. | Reflections: "this is the start of our conversation, no task has been given." Judge scored 15/100. Brightcart wrote 0 memories (memory only stores on non-empty result). | `base_agent.py:151-155` — System+Human messages built locally in `_think` but never returned into graph state; when the model responds tool-use-only (dropped by P0-2), `result` stays empty and `_reflect` sees a task-less conversation. |

### P1 — major

| # | Bug | Evidence / root |
|---|---|---|
| P1-1 | Invalid `model` accepted at create; the run then fails **silently**: 3 hidden Celery retries (~42 s of worker time), agent lands in `error`, no work-log row, no user-visible error, $0 recorded. | Probe `adv-bad-model`; no model allowlist in `agents.py`; failure path in `agent_tasks.py:115-126` writes no row. |
| P1-2 | Failed runs are invisible and unbilled: no work-log row, no UI surface, real Anthropic spend (partial calls, retries) unrecorded. | Same failure path; billing derives only from work_log rows. |
| P1-3 | Billing ledger self-reverts: deleting an agent deletes its work_log (cascade) and with it the org's recorded spend. Reported monthly spend after the test: **$0.00**; real spend: **$0.66**. | `/billing/usage` computes live from work_log; observed $0.34 → $0.17 → $0.00 progression as personas were cleaned up. |
| P1-4 | Horizontal overflow on `/`, `/live`, `/network` at both 390 px (390 px spill) and 1440 px (448 px spill) — some element is ~1888 px wide. Prod mobile `/live` confirmed too. | Tier-1 page metrics; prod UI probe finding. |
| P1-5 | Fleet SSE stream missing run lifecycle framing: probe consuming `/stream/fleet` during a run saw token deltas + snapshots but no `RUN_STARTED`/`RUN_FINISHED` in-window, and caught a `RUN_ERROR` from an unrelated agent (bad-model retries) with no agent attribution in the probe's view. | Probe `adv-sse`; events published in `agent_tasks.py:46,107` — likely emitted before subscribers attach / fan-out ordering. |

### P2 — minor

- Empty agent name → 201 (expected 422); 10 KB name/title accepted; no length limits on any agent field.
- Unknown `task_type` (`totally_made_up_type`) accepted, executed, billed — no allowlist.
- `RunTaskRequest.model` is accepted by the API but silently ignored (dispatch always uses `agent.model`, `agents.py:60-66`).
- Judge exceptions silently score 50 (`eval/judge.py`); eval/judge/evolution API calls are unbilled.
- No LLM/Celery timeout — a hung call stalls a worker slot indefinitely (single worker in prod).
- Signup creates permanent org rows (no org delete endpoint); each stress signup leaves invisible residue.
- After UI hire, user remains on `/agents/new` — no redirect/link to the new agent or a first job.
- Demo mode is never labeled — no banner, no hint the data is fake (local and, currently, prod).
- Deleting an agent nulls its comms rows → A2A history quietly disappears from the network view.

### P3 — polish

- `/login`, `/hq` have no `<h1>`; one icon-only button per page lacks an accessible name; `/live` has 18 sub-32 px tap targets on mobile.
- 404 route logs a console error for a missing resource.
- Benign-but-noisy RSC prefetch `ERR_ABORTED` entries on most navigations (Next.js prefetch cancellation).

---

## Optimization plan (ranked — NOT executed in this phase)

**Phase A — make the product real (1 day, do in this order)**
1. **Wire prod frontend to the backend** — add `ARG NEXT_PUBLIC_API_URL` / `ENV` before `next build` in `frontend/Dockerfile`, redeploy. *Effort: 30 min. This single change turns the live site from a demo into the product.*
2. **Fix the tool loop** — in `BaseAgent._think`, aggregate chunks (`acc = acc + chunk` or use `.ainvoke` when tools are bound) so `tool_calls` survive; return the System/Human messages into graph state so reflection and multi-step loops keep the task. *Effort: 2–4 h.*
3. **Re-run the stress workflow** (`railway-smoke.yml` dispatch on this branch) — the same probes that failed (`p*-a2a-child`, `p5-notify-human`, empty-result tasks) are the regression suite. *Effort: 30 min, ~$1.*

**Phase B — trust & visibility (≈1 week)**
4. Model allowlist at agent create/update + honor-or-remove `RunTaskRequest.model`. *(2 h)*
5. Write a work-log row for **failed** runs (status field) and surface run errors in the UI; add Celery `soft_time_limit`. *(0.5–1 d)*
6. Immutable billing: persist usage to an org-level ledger (or soft-delete agents) so spend survives deletion; bill failed runs and judge/evolution calls. *(1 d)*
7. Fix the ~1888 px-wide element behind the `/`, `/live`, `/network` overflow; mobile tap-target pass on `/live`. *(0.5 d)*
8. Input validation: non-empty trimmed names, length caps, `task_type` allowlist. *(2 h)*

**Phase C — product depth (backlog, post-fix)**
9. Turn `REQUIRE_AUTH=true` on prod once the frontend sends keys — tenancy is already built and tested; today signup issues keys that isolate nothing. *(0.5 d + comms)*
10. Demo-mode banner ("You're exploring sample data") + post-hire redirect to the new agent's profile with a "give them their first job" CTA. *(0.5 d)*
11. SSE lifecycle completeness (guarantee RUN_STARTED/FINISHED delivery, attribute RUN_ERROR); judge-failure handling (skip score instead of silent 50); org delete endpoint; preserve comms history on agent delete. *(1–2 d)*
12. A11y pass: h1s, icon-button labels, tap targets. *(0.5 d)*

---

## What was verified clean

- All 17 test agents deleted (204 + confirmed 404); final agent list `[]`; workspace diff `added=set() removed=set()`.
- Budget guard honored throughout; spend cap never approached ($0.66 of $10 cap).
- Backend latency, burst behavior, and delete cascades are production-grade.
- Easy-tier text tasks produce genuinely good output (all keyword checks passed where results were non-empty on text-only tasks; the Opus strategy and long-document legal analysis were high quality — the long-input task even correctly identified that the input was truncated).
