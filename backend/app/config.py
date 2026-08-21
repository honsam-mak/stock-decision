from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    opensearch_host: str = "http://opensearch:9200"
    opensearch_user: str = ""
    opensearch_password: str = ""
    opensearch_verify_certs: bool = False

    index_prefix: str = "sds"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    alpha_vantage_key: str = ""

    # Seconds a cached market_data_cache entry stays fresh before refetching.
    market_cache_ttl: int = 8 * 60 * 60

    http_timeout: float = 20.0

    class Config:
        env_file = ".env"
        env_prefix = ""


settings = Settings()

# Logical collections mirroring the original Firestore layout.
COLLECTIONS = ["stocks", "simulations", "records", "settings", "market_data_cache"]


def index_for(collection: str) -> str:
    return f"{settings.index_prefix}-{collection}"
