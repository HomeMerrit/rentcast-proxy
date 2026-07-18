from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://agentplatform:agentplatform@localhost:5432/agentplatform"
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    environment: str = "development"
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    e2b_api_key: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"
    require_auth: bool = False
    enable_rate_limit: bool = False
    # Fixed-window request budget per API key (or per client IP when unauthenticated).
    rate_limit_per_minute: int = 120
    # Document upload guards.
    max_upload_mb: int = 8
    max_upload_files: int = 25
    # Per-tenant spend guard. Each org gets a monthly USD cap; once the current
    # calendar month's task cost reaches it, new task dispatch is refused (402).
    # Set an org's monthly_budget_usd to NULL to remove its cap. enforce_budget
    # is the global kill-switch (accounting still runs; only blocking is skipped).
    default_monthly_budget_usd: float = 50.0
    enforce_budget: bool = True
    # Observability. JSON logs are the norm in production (one object per line);
    # SENTRY_DSN, when set and sentry-sdk is installed, turns on error tracking.
    log_level: str = "INFO"
    log_json: bool = False
    sentry_dsn: str = ""
    # Comma-separated extra CORS origins (in addition to localhost + *.up.railway.app)
    cors_origins: str = ""
    # Default organization used to scope data when auth is disabled (pilots/dev) and to
    # backfill pre-tenancy rows. Every tenant-owned row belongs to exactly one org.
    default_org_id: str = "00000000-0000-0000-0000-000000000001"
    default_org_name: str = "Default workspace"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
