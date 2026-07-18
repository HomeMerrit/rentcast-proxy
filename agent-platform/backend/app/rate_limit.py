"""Per-key (else per-IP) fixed-window rate limiting, backed by Redis.

A single ASGI middleware — no per-route wiring. Active only when
`ENABLE_RATE_LIMIT=true`. Fails OPEN if Redis is unreachable so a limiter
outage can't take the API down. The identifier is the API key when present
(header Bearer or the SSE `?token=`), otherwise the client IP, so one tenant
can't exhaust another's budget.
"""
import hashlib
import time
from fastapi import Request
from fastapi.responses import JSONResponse
from .config import settings

# Long-lived streams and health checks are not counted.
_EXEMPT_PREFIXES = ("/health", "/stream")


def _identifier(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return "k:" + hashlib.sha256(auth[7:].encode()).hexdigest()[:32]
    tok = request.query_params.get("token")
    if tok:
        return "k:" + hashlib.sha256(tok.encode()).hexdigest()[:32]
    host = request.client.host if request.client else "unknown"
    return "ip:" + host


async def rate_limit_middleware(request: Request, call_next):
    if not settings.enable_rate_limit:
        return await call_next(request)
    path = request.url.path
    if path.startswith(_EXEMPT_PREFIXES):
        return await call_next(request)
    redis = getattr(request.app.state, "limiter_redis", None)
    if redis is None:
        return await call_next(request)

    limit = max(1, settings.rate_limit_per_minute)
    window = 60
    now = int(time.time())
    bucket = now // window
    key = f"rl:{_identifier(request)}:{bucket}"
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window)
    except Exception:
        return await call_next(request)  # fail open on Redis errors

    if count > limit:
        retry = window - (now % window)
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please slow down and try again shortly."},
            headers={"Retry-After": str(retry), "X-RateLimit-Limit": str(limit)},
        )
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - count))
    return response
