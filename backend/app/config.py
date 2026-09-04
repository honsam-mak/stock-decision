from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )

    store_backend: str = "opensearch"

    opensearch_host: str = "http://opensearch:9200"
    opensearch_user: str = ""
    opensearch_password: str = ""
    opensearch_verify_certs: bool = False

    index_prefix: str = "sds"

    # Use the Supabase transaction-pooler URL when STORE_BACKEND=postgres.
    database_url: str = ""

    # Local development remains usable without an identity provider. Production
    # deployments should explicitly set AUTH_DISABLED=false.
    auth_disabled: bool = True
    local_user_id: str = "local"
    supabase_url: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    owner_user_id: str = ""
    owner_email: str = ""

    # Comma-separated origins, or "*" for local development.
    cors_origins: str = "*"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    alpha_vantage_key: str = ""

    # Seconds a cached market_data_cache entry stays fresh before refetching.
    market_cache_ttl: int = 8 * 60 * 60

    http_timeout: float = 20.0

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",")]
        return [origin for origin in origins if origin] or ["*"]


settings = Settings()

# Logical collections mirroring the original Firestore layout.
COLLECTIONS = ["stocks", "simulations", "records", "settings", "market_data_cache"]


def index_for(collection: str) -> str:
    return f"{settings.index_prefix}-{collection}"
