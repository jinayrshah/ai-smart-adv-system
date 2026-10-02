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

    # Market Data
    DATA_GOV_IN_KEY: str = ""
    MARKET_API_KEY: str = ""  # fallback / legacy name
    CEDA_API_KEY: str = ""

    # Weather
    OPENWEATHER_API_KEY: str = ""
    WEATHER_ONDEMAND_MAX_NEW_GRIDS: int = 300

    # Advisory / AI
    GEMINI_API_KEY: str = ""

    # Operational
    LOG_LEVEL: str = "INFO"
    MANDI_WATCH_MAX_TRACKED: int = 300

    @property
    def effective_data_gov_key(self) -> str:
        return self.DATA_GOV_IN_KEY or self.MARKET_API_KEY


@lru_cache()
def get_settings() -> Settings:
    return Settings()
