"""Structured logging, request correlation, and a catch-all error boundary.

Everything here imports only stdlib + FastAPI (plus an optional soft import of
sentry_sdk), so it can be unit-tested without the agent runtime. `main.py` wires
it into the real app; tests exercise the same functions against a minimal app.

Design:
  * Every request gets an X-Request-ID (honored from the client or minted) that
    is stashed in a contextvar so every log line emitted while handling that
    request carries it — logs from a failed request are trivially greppable.
  * Unhandled exceptions never leak a stack trace or internal message to the
    client: they are logged in full (with the request id) and answered with a
    flat 500 `{"detail": "Internal server error", "request_id": ...}`.
  * Logs are JSON in production (one object per line, ingestible by any log
    platform) and human-readable locally.
"""
import json
import logging
import sys
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders

logger = logging.getLogger("agentos")

# Correlation id for the in-flight request; None outside a request.
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class _RequestIdFilter(logging.Filter):
    """Attach the current request id to every record so formatters can emit it."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        rid = getattr(record, "request_id", None)
        if rid:
            payload["request_id"] = rid
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    """Install a single stdout handler on the root logger (JSON or plain).

    Called once at startup. Also routes uvicorn's loggers through the root so
    access/error lines share the same format and correlation id.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    if json_logs:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # Let uvicorn's loggers bubble up to the root handler instead of their own.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True


class RequestIdMiddleware:
    """Pure-ASGI request correlation.

    A pure ASGI middleware (not BaseHTTPMiddleware) is used deliberately: it runs
    the inner app in the *same* task, so the id it stashes on `scope` is visible
    to the outer ServerErrorMiddleware when it invokes the 500 handler — a
    contextvar set by a BaseHTTPMiddleware would not survive that task boundary.
    The id is put on both `scope["request_id"]` (for the error handler) and the
    logging contextvar (for correlated log lines), and echoed as X-Request-ID.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        incoming = dict(scope.get("headers") or {})
        raw = incoming.get(b"x-request-id")
        request_id = raw.decode("latin-1") if raw else str(uuid.uuid4())
        scope["request_id"] = request_id
        token = request_id_ctx.set(request_id)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_ctx.reset(token)


def add_exception_handler(app: FastAPI) -> None:
    """Register the catch-all boundary for otherwise-unhandled exceptions.

    HTTPException and RequestValidationError keep FastAPI's own handling; this
    only catches the unexpected, so a bug becomes a logged 500, not a leaked
    stack trace. The correlation id is read from `scope` (set by
    RequestIdMiddleware) so it survives even though this handler runs in the
    outermost ServerErrorMiddleware, after inner middleware has unwound.
    """

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):  # noqa: ANN001
        request_id = request.scope.get("request_id")
        # Re-bind the id so this error line is correlated too (the middleware's
        # contextvar has already been reset by the time we get here).
        token = request_id_ctx.set(request_id) if request_id else None
        try:
            logger.exception("unhandled error on %s %s", request.method, request.url.path)
        finally:
            if token is not None:
                request_id_ctx.reset(token)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
            headers={"X-Request-ID": request_id} if request_id else None,
        )


def init_sentry(dsn: str, environment: str) -> bool:
    """Initialise Sentry if a DSN is set and the SDK is importable.

    Returns True when Sentry was activated. Soft-fails (returns False, logs a
    line) when the SDK isn't installed, so the app never hard-depends on it.
    """
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed — skipping")
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.0,  # errors only by default; opt into tracing explicitly
        send_default_pii=False,
    )
    logger.info("Sentry error tracking ENABLED (env=%s)", environment)
    return True
