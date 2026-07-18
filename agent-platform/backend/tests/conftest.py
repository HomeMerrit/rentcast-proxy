"""Test config. Set env BEFORE any app import so app.config picks up the test DB."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/agentos_test")
os.environ.setdefault("REQUIRE_AUTH", "true")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-not-used")
