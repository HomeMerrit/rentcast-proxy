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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
