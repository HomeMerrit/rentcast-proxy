# Deploy the AgentOS UI to Vercel

The frontend (Next.js 15) lives in `agent-platform/frontend` and is ready to deploy to Vercel.

## One-time setup (in the Vercel dashboard)

1. **New Project → Import** this GitHub repo (`HomeMerrit/rentcast-proxy`).
2. **Root Directory:** click *Edit* and set it to **`agent-platform/frontend`**.
   Vercel auto-detects Next.js (build `next build`, install `npm ci`).
3. **Environment Variables** (Production + Preview):
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | your backend URL, e.g. `https://backend-production-a20b.up.railway.app` |
   | `NEXT_PUBLIC_STREAM_URL` | same backend URL (for live SSE) |
   | `NEXT_PUBLIC_REQUIRE_AUTH` | `false` (or `true` to gate the UI behind an API key) |
4. **Deploy.** Every push to the branch auto-builds a preview; production follows your chosen branch.

## Backend CORS
The backend already allows `*.vercel.app` and `*.up.railway.app` origins, plus any origin listed
in the backend's `CORS_ORIGINS` env var (comma-separated). If you use a custom Vercel domain,
add it to `CORS_ORIGINS` on the backend service.

## Notes
- `NEXT_PUBLIC_*` values are baked at build time — after changing them, redeploy.
- The app is dark-theme, mobile-responsive, and needs no other services (the backend handles
  Postgres/Redis/Qdrant/Celery on Railway).
