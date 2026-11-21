from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.integrations.google_maps import get_maps_client
from services.api.app.integrations.weather import get_weather_provider
from services.api.app.models.schemas import EmergencyContactRequest, ShareLocationRequest
from services.common.i18n import localize_doc
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1", tags=["alerts_and_safety"])


@router.get("/alerts")
def list_alerts(
    state: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    docs = repo.query_docs("alerts", filters=filters, order_by="starts_at", descending=True)
    return {"items": [localize_doc(d, lang) for d in docs]}


@router.get("/weather")
async def get_weather(
    lat: float = Query(default=25.5788),
    lng: float = Query(default=91.8933),
) -> dict:
    provider = get_weather_provider()
    return await provider.get_forecast(lat, lng)


@router.get("/safety/nearby")
async def safety_nearby(
    lat: float = Query(default=26.1445),
    lng: float = Query(default=91.7362),
    type: str = Query(default="all", pattern="^(all|hospital|police)$"),
) -> dict:
    maps = get_maps_client()
    items = await maps.safety_nearby_search(lat, lng, kind=type)
    return {"items": items}


@router.get("/safety/helplines")
def safety_helplines(
    state: Optional[str] = Query(default=None),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    if state:
        sc = state.upper()
        docs = [d for d in repo.list_docs("helplines") if d.get("state_code") in (sc, "ALL")]
    else:
        docs = repo.list_docs("helplines")
    return {"items": docs}


@router.get("/safety/contacts")
def list_emergency_contacts(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    items = repo.list_subdocs("user_profiles", user.uid, "emergency_contacts")
    return {"items": items}


@router.post("/safety/contacts")
def add_emergency_contact(
    body: EmergencyContactRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    cid = f"ec_{uuid.uuid4().hex[:8]}"
    saved = repo.set_subdoc(
        "user_profiles",
        user.uid,
        "emergency_contacts",
        cid,
        {"id": cid, "user_id": user.uid, "name": body.name, "phone": body.phone, "relation": body.relation},
    )
    return {"contact": saved}


@router.delete("/safety/contacts/{contact_id}")
def remove_emergency_contact(
    contact_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    deleted = repo.delete_subdoc("user_profiles", user.uid, "emergency_contacts", contact_id)
    return {"deleted": deleted}


@router.post("/safety/share-location")
def share_live_location(
    body: ShareLocationRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    token = uuid.uuid4().hex[:12]
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=body.expires_minutes)).isoformat()
    record = repo.set_doc(
        "live_location_shares",
        token,
        {
            "id": token,
            "user_id": user.uid,
            "lat": body.lat,
            "lng": body.lng,
            "note": body.note,
            "created_at": utc_now_iso(),
            "expires_at": expires_at,
        },
    )
    return {
        "share_token": token,
        "share_url": f"/safety?beacon={token}",
        "expires_at": expires_at,
        "record": record,
    }
