from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.agent.app.router import router as chat_router
from services.common.config import get_settings
from services.common.firebase_client import get_firebase_status, init_firebase

settings = get_settings()
init_firebase()

app = FastAPI(title="NE Mate AI Agent Service", version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_router)


@app.get("/api/v1/agent/health")
def agent_health() -> dict:
    return {
        "status": "ok",
        "llm_provider": settings.llm_provider,
        "llm_configured": bool(settings.llm_api_key.strip()),
        "firebase": get_firebase_status(),
    }
