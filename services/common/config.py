from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / ".env"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH, override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "local"
    app_version: str = "1.0.0"
    api_base_url: str = "http://127.0.0.1:8000"
    agent_base_url: str = "http://127.0.0.1:8001"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Firebase configuration
    firebase_mode: str = "auto"  # auto | firestore | emulator | local
    firebase_project_id: str = "ne-mate-dev"
    firebase_database_id: str = "(default)"
    firebase_storage_bucket: str = ""
    firebase_service_account_path: str = ""
    firebase_service_account_json: str = ""
    google_application_credentials: str = ""
    firestore_emulator_host: str = ""
    firebase_auth_emulator_host: str = ""
    firebase_storage_emulator_host: str = ""
    dev_auth_bypass: bool = True

    # Google Maps
    google_maps_server_key: str = ""
    next_public_google_maps_browser_key: str = ""

    # LLM & Embeddings
    llm_provider: str = "gemini"  # gemini | openai
    llm_api_key: str = ""
    llm_model: str = "gemini-3.8-flash"
    llm_base_url: str = ""
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-004"
    llm_daily_token_budget: int = 100000

    # Redis & External Providers
    redis_url: str = "redis://localhost:6379/0"
    rapidapi_railway_key: str = ""
    rapidapi_railway_host: str = "irctc1.p.rapidapi.com"
    rapidapi_live_enabled: bool = False
    weather_api_key: str = ""
    weather_api_base_url: str = ""

    # Web Push & Observability
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:support@nemate.example.in"
    sentry_dsn: str = ""

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def local_db_dir(self) -> Path:
        return REPO_ROOT / "data" / ".local_db"

    @property
    def local_uploads_dir(self) -> Path:
        return REPO_ROOT / "data" / ".local_uploads"

    @property
    def seed_dir(self) -> Path:
        return REPO_ROOT / "data" / "seed"

    def resolve_service_account_path(self) -> Path | None:
        raw = (self.firebase_service_account_path or "").strip()
        if not raw:
            return None
        p = Path(raw)
        if not p.is_absolute():
            p = REPO_ROOT / p
        return p


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
