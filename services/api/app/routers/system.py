from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from services.api.app.deps.auth import get_repo_dep
from services.api.app.integrations.google_maps import get_maps_client
from services.common.cache import get_cache
from services.common.config import get_settings
from services.common.firebase_client import get_firebase_status
from services.common.i18n import localize_doc
from services.common.repository import BaseNoSQLRepo

router = APIRouter(prefix="/api/v1", tags=["system"])


@router.get("/health")
def health_check() -> dict:
    settings = get_settings()
    fb = get_firebase_status()
    redis_ok = get_cache().ping()
    maps_ok = get_maps_client().configured
    llm_ok = bool(settings.llm_api_key.strip())
    return {
        "status": "ok" if fb["connected"] else "degraded",
        "version": settings.app_version,
        "env": settings.app_env,
        "firebase": fb,
        "redis": {"connected": redis_ok, "fallback": not redis_ok},
        "google_maps": {"server_key_configured": maps_ok},
        "llm": {"provider": settings.llm_provider, "configured": llm_ok, "model": settings.llm_model},
    }


@router.get("/version")
def version_info() -> dict:
    settings = get_settings()
    return {
        "app": "NE Mate",
        "version": settings.app_version,
        "api_prefix": "/api/v1",
        "database": "firebase-firestore-nosql",
    }


@router.get("/states")
def list_states(
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    docs = repo.list_docs("states", order_by="code")
    return {"items": [localize_doc(d, lang) for d in docs]}
