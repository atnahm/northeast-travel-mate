from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from services.api.app.routers import (
    admin,
    alerts_safety,
    auth_profile,
    documents,
    offline_sync,
    permits,
    places,
    system,
    trains,
    travel,
    trips,
)
from services.agent.app.router import router as agent_chat_router
from services.common.cache import get_cache
from services.common.config import get_settings
from services.common.firebase_client import get_resolved_mode, init_firebase

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ne_mate.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    mode = init_firebase()
    logger.info("NE Mate Core API ready (Firebase NoSQL mode=%s).", mode)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="NE Mate Core API",
        version=settings.app_version,
        description="North-East India Travel Mate REST API (Cloud Firestore NoSQL + Google Maps + AI Agent)",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context_and_rate_limit(request: Request, call_next):
        req_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = req_id

        # Rate limits per B4.10 (60 rpm general, 10 rpm chat messages)
        path = request.url.path
        if path.startswith("/api/v1/") and path != "/api/v1/health":
            client_ip = request.client.host if request.client else "unknown"
            is_chat_msg = "/chat/threads/" in path and path.endswith("/messages")
            limit = 10 if is_chat_msg else 60
            bucket = f"rl:{client_ip}:{'chat' if is_chat_msg else 'api'}"
            allowed, remaining = get_cache().check_rate_limit(bucket, max_requests=limit, window_seconds=60)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "rate_limited",
                            "message": "Too many requests. Please slow down and try again shortly.",
                            "request_id": req_id,
                        }
                    },
                )
            response = await call_next(request)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        else:
            response = await call_next(request)

        response.headers["X-Request-Id"] = req_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.exception_handler(HTTPException)
    async def http_exc_handler(request: Request, exc: HTTPException):
        req_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": f"http_{exc.status_code}",
                    "message": str(exc.detail),
                    "request_id": req_id,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exc_handler(request: Request, exc: Exception):
        req_id = getattr(request.state, "request_id", uuid.uuid4().hex[:12])
        logger.exception("Unhandled error (request_id=%s, mode=%s)", req_id, get_resolved_mode())
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected server error occurred.",
                    "request_id": req_id,
                }
            },
        )

    for r in (
        system.router,
        auth_profile.router,
        places.router,
        trains.router,
        travel.router,
        permits.router,
        trips.router,
        alerts_safety.router,
        documents.router,
        offline_sync.router,
        admin.router,
        agent_chat_router,
    ):
        app.include_router(r)

    return app


app = create_app()
