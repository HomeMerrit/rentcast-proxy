"""Error boundary, request correlation, and structured logging.

Exercises the observability layer against a minimal app (no agent runtime):

  * an unhandled exception becomes a flat 500 that leaks neither the message
    nor a stack trace, and carries a request id
  * X-Request-ID is echoed (minted when absent, honored when supplied) and the
    id is the same one bound into the log contextvar during the request
  * HTTPException still gets its own status (the boundary only catches the
    unexpected)
  * the JSON log formatter emits one parseable object per record, with the id
"""
import json
import logging

import pytest
import httpx
from fastapi import FastAPI, HTTPException

from app.observability import (
    add_exception_handler,
    RequestIdMiddleware,
    request_id_ctx,
    configure_logging,
    _JsonFormatter,
    _RequestIdFilter,
)

SECRET = "super-secret-internal-detail-42"


def _make_app() -> FastAPI:
    app = FastAPI()
    add_exception_handler(app)
    app.add_middleware(RequestIdMiddleware)

    @app.get("/boom")
    async def boom():
        raise RuntimeError(SECRET)

    @app.get("/nope")
    async def nope():
        raise HTTPException(404, "not here")

    @app.get("/whoami")
    async def whoami():
        # The id bound for this request, as seen from inside the handler.
        return {"rid": request_id_ctx.get()}

    return app


@pytest.fixture
async def client():
    app = _make_app()
    # raise_app_exceptions=False: Starlette's ServerErrorMiddleware sends our 500
    # response and then re-raises so the server can log it; without this flag the
    # test transport would re-raise instead of returning the response we assert on.
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_unhandled_exception_becomes_clean_500(client):
    r = await client.get("/boom")
    assert r.status_code == 500
    body = r.json()
    assert body["detail"] == "Internal server error"
    # Never leak the exception text or a traceback.
    assert SECRET not in r.text
    assert "Traceback" not in r.text
    # A correlation id is present in the body and echoed in the header.
    assert body["request_id"]
    assert r.headers["X-Request-ID"] == body["request_id"]


async def test_request_id_is_minted_and_echoed(client):
    r = await client.get("/whoami")
    assert r.status_code == 200
    rid = r.headers["X-Request-ID"]
    assert rid
    # The header id is exactly the one bound into the contextvar for the request.
    assert r.json()["rid"] == rid


async def test_supplied_request_id_is_honored(client):
    r = await client.get("/whoami", headers={"X-Request-ID": "trace-abc"})
    assert r.headers["X-Request-ID"] == "trace-abc"
    assert r.json()["rid"] == "trace-abc"


async def test_contextvar_cleared_after_request(client):
    await client.get("/whoami")
    # Outside any request the correlation id is reset, not left dangling.
    assert request_id_ctx.get() is None


async def test_http_exception_still_passes_through(client):
    r = await client.get("/nope")
    assert r.status_code == 404
    assert r.json()["detail"] == "not here"


def test_json_formatter_emits_parseable_line_with_request_id():
    token = request_id_ctx.set("rid-xyz")
    try:
        record = logging.LogRecord("agentos", logging.INFO, __file__, 1, "hello", None, None)
        _RequestIdFilter().filter(record)
        line = _JsonFormatter().format(record)
    finally:
        request_id_ctx.reset(token)
    obj = json.loads(line)
    assert obj["msg"] == "hello"
    assert obj["level"] == "INFO"
    assert obj["request_id"] == "rid-xyz"


def test_configure_logging_installs_single_root_handler():
    configure_logging(level="DEBUG", json_logs=True)
    root = logging.getLogger()
    assert len(root.handlers) == 1
    assert root.level == logging.DEBUG
    # Restore a sane default for any later tests.
    configure_logging(level="INFO", json_logs=False)
