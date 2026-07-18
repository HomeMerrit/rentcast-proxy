# AgentOS — Go-Live Checklist (owner actions)

This file tracks the things **you** need to do that Claude Code cannot do from the
build environment — because they need credentials, external accounts, or
infrastructure changes. Everything in code is already done and CI-green; the items
below are operational.

Last updated: 2026-07-18.

---

## 1. Flip the production safety switches (config only — do this first)

The code for all of these is shipped and tested; they are **off by default** so
local/dev stays frictionless. Set them on the **Railway backend service** (and the
celery + frontend services where noted) to enforce them in production:

| Env var | Set to | Service(s) | What it turns on |
|---|---|---|---|
| `REQUIRE_AUTH` | `true` | backend | API-key auth on every endpoint (no key → 401) |
| `ENABLE_RATE_LIMIT` | `true` | backend | Per-key Redis rate limiting |
| `RATE_LIMIT_PER_MINUTE` | e.g. `120` | backend | Requests/min budget per key |
| `ENFORCE_BUDGET` | `true` | backend | Hard monthly spend cap (402 when over) |
| `DEFAULT_MONTHLY_BUDGET_USD` | e.g. `50` | backend, celery | Default per-org cap for new workspaces |
| `LOG_JSON` | `true` | backend, celery | Structured one-line-JSON logs |
| `LOG_LEVEL` | `INFO` | backend, celery | Log verbosity |
| `NEXT_PUBLIC_REQUIRE_AUTH` | `true` | frontend | Frontend shows login/signup flow |

After setting these, redeploy the backend and confirm `/health` returns
`{"status":"ok","auth_required":true}`.

> Note on the live database: the backend now migrates via **Alembic**. On the next
> deploy, `adopt_or_upgrade` will detect the existing (pre-Alembic) Railway DB and
> **stamp** it to the baseline in place — no data changes, no downtime. Subsequent
> schema changes ship as new Alembic revisions.

## 2. Error tracking (optional but recommended)

- Create a Sentry project (or reuse one) and copy its DSN.
- Set `SENTRY_DSN=<dsn>` on the **backend** and **celery** services.
- `sentry-sdk[fastapi]` is already in requirements; when the DSN is present the app
  auto-initializes error tracking. No DSN → silently no-ops.

## 3. Anthropic + optional integrations

- `ANTHROPIC_API_KEY` — **required** for agents to run (already set if agents work today).
- `E2B_API_KEY` — **required in production** for code execution. Without it, the
  code-exec tool refuses to run (it will not fall back to unsandboxed subprocess in
  prod, by design). Set this if your agents need to run code.
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` — optional tracing.

## 4. Phase 5 — Repo split + staging/prod (infra, needs you)

Claude can prepare the code, but these steps need account/infra access:

- [ ] Create a new GitHub repo for `agent-platform` (it currently lives inside
      `rentcast-proxy`). Move `agent-platform/**` there (preserve history with
      `git filter-repo` or a subtree split).
- [ ] Point a **staging** Railway project + Vercel project at a `staging` branch;
      keep prod on `main`.
- [ ] Recreate the env vars from sections 1–3 in each environment.
- [ ] Update the CI workflow path filters / deploy workflows to the new repo layout.

## 5. Phase 6 — Billing (Stripe, needs your account)

The per-tenant budget system (spend accounting + hard caps) is already live and is
the natural metering layer for billing. To turn it into paid plans:

- [ ] Create a Stripe account; create Products/Prices for the plan tiers.
- [ ] Provide `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (backend env).
- [ ] Decide the plan → `monthly_budget_usd` mapping (e.g. Pilot $50, Pro $500).
- [ ] Then Claude can wire: checkout/session creation, a `/billing/webhook`
      endpoint that updates `organizations.plan` + `monthly_budget_usd` on
      subscription events, and the upgrade UI. (Code can be scaffolded now with
      test keys if you want to review before going live.)

## 6. Nice-to-haves already coded, just confirm

- [ ] Confirm the CI gate is a **required status check** on the branch (GitHub →
      Settings → Branches) so red CI blocks merges.
- [ ] Rotate/verify the `POSTGRES_PASSWORD` used by the prod compose if self-hosting.

---

### Status of the build work (all done, CI-green)

- Phase 1 — Multi-tenancy (orgs, per-org scoping, signup, isolation tests) ✅
- Phase 2 — Rate limiting, sandbox-only exec, upload guards, per-tenant spend caps ✅
- Phase 3 — CI merge gate, structured logging + error boundary + Sentry hook,
  resumable onboarding + review-before-hire ✅
- Phase 4 — Alembic migrations, `create_all` retired, drift guard ✅
