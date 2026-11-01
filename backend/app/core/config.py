from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # JWT secret from Supabase dashboard → Settings → API → JWT Secret.
    # When set, /api/farmer/* routes enforce ownership checks.
    SUPABASE_JWT_SECRET: str = ""
    # Secret the Express login server (server.ts) signs its tokens with; used when
    # SUPABASE_JWT_SECRET is unset so farmer routes are owner-checked with the app's own logins.
    JWT_SECRET: str = ""

    # Market Data
    DATA_GOV_IN_KEY: str = ""
    MARKET_API_KEY: str = ""  # fallback / legacy name
    CEDA_API_KEY: str = ""

    # Weather
    OPENWEATHER_API_KEY: str = ""
    WEATHER_ONDEMAND_MAX_NEW_GRIDS: int = 300
    # Longest window (days) we backfill weather history for a new farm/crop so the
    # GDD engine can run on thermal time instead of the calendar fallback.
    WEATHER_HISTORY_BACKFILL_MAX_DAYS: int = 240

    # Advisory / AI
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: str = ""
    # Groq (OpenAI-compatible, free tier). When keys are set it is tried before Gemini.
    GROQ_API_KEYS: str = ""  # comma-separated; GROQ_API_KEY also accepted
    GROQ_API_KEY: str = ""
    GROQ_MODELS: str = "llama-3.3-70b-versatile,llama-3.1-8b-instant"
    GROQ_VISION_MODELS: str = "meta-llama/llama-4-scout-17b-16e-instruct,meta-llama/llama-4-maverick-17b-128e-instruct"
    # Model ids live in config (Architecture_Advisory.md §20: models get deprecated on a
    # schedule). The first model is tried first; the rest are fallbacks on 404/429/5xx.
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    GEMINI_FALLBACK_MODELS: str = "gemini-3-flash-preview"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Bhashini (ULCA) — Architecture_Advisory.md §15
    BHASHINI_USER_ID: str = ""
    BHASHINI_API_KEY: str = ""  # the ULCA API key ("ulcaApiKey")
    BHASHINI_PIPELINE_ID: str = "64392f96daac500b55c543cd"  # MeitY default pipeline

    # Disease model (Architecture_Advisory.md §22)
    DISEASE_MODEL_PATH: str = "models/disease_mobilenetv2_v1.keras"
    DISEASE_CLASSES_PATH: str = ""  # defaults to <model dir>/disease_classes.json
    DISEASE_MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024

    # HTTP / security
    # Comma-separated list of allowed browser origins. "*" disables credentials.
    CORS_ALLOW_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Comma-separated list of proxy IPs whose X-Forwarded-For header is trusted
    # (the Express server that fronts FastAPI runs on the same host).
    TRUSTED_PROXY_IPS: str = "127.0.0.1,::1"
    RATE_LIMIT_PER_MINUTE: int = 300

    # Operational
    LOG_LEVEL: str = "INFO"
    MANDI_WATCH_MAX_TRACKED: int = 300

    @property
    def effective_data_gov_key(self) -> str:
        return self.DATA_GOV_IN_KEY or self.MARKET_API_KEY

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]

    @property
    def trusted_proxies(self) -> set[str]:
        return {p.strip() for p in self.TRUSTED_PROXY_IPS.split(",") if p.strip()}

    @property
    def gemini_api_keys(self) -> list[str]:
        keys = [k.strip() for k in self.GEMINI_API_KEYS.split(",") if k.strip()]
        if self.GEMINI_API_KEY.strip() and self.GEMINI_API_KEY.strip() not in keys:
            keys.insert(0, self.GEMINI_API_KEY.strip())
        return keys

    @property
    def groq_api_keys(self) -> list[str]:
        keys = [k.strip() for k in f"{self.GROQ_API_KEY},{self.GROQ_API_KEYS}".split(",") if k.strip()]
        return list(dict.fromkeys(keys))

    @property
    def gemini_models(self) -> list[str]:
        models = [self.GEMINI_MODEL.strip()] if self.GEMINI_MODEL.strip() else []
        for m in self.GEMINI_FALLBACK_MODELS.split(","):
            m = m.strip()
            if m and m not in models:
                models.append(m)
        return models or ["gemini-3.8-flash"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
