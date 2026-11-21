from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.integrations.google_maps import get_maps_client
from services.api.app.models.schemas import SavedPlaceRequest
from services.common.geo import haversine_km
from services.common.i18n import localize, localize_doc
from services.common.repository import BaseNoSQLRepo

router = APIRouter(prefix="/api/v1", tags=["places"])


@router.get("/places/nearby")
async def places_nearby(
    lat: float = Query(default=26.1445),
    lng: float = Query(default=91.7362),
    radius: float = Query(default=250.0, description="Radius in km"),
    category: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    places = repo.query_docs("places", filters=filters)
    results = []
    for pl in places:
        if category and category != "all" and category not in (pl.get("categories") or []):
            continue
        dist = haversine_km(lat, lng, pl["lat"], pl["lng"])
        if dist <= radius:
            enriched = localize_doc(pl, lang)
            enriched["distance_km"] = round(dist, 1)
            results.append(enriched)
    results.sort(key=lambda x: x["distance_km"])
    return {"items": results, "center": {"lat": lat, "lng": lng}}


@router.get("/places/search")
async def search_places(
    q: str = Query(default=""),
    state: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    featured: Optional[bool] = Query(default=None),
    lang: str = Query(default="en"),
    include_google: bool = Query(default=False),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    places = repo.query_docs("places", filters=filters)
    query_l = q.strip().lower()
    matched = []
    for pl in places:
        if featured is not None and bool(pl.get("is_featured")) != featured:
            continue
        if category and category != "all" and category not in (pl.get("categories") or []):
            continue
        if query_l:
            haystack = " ".join(
                [
                    localize(pl.get("name_i18n"), "en"),
                    localize(pl.get("name_i18n"), lang),
                    localize(pl.get("curated_notes_i18n"), "en"),
                    pl.get("state_code", ""),
                    " ".join(pl.get("categories") or []),
                ]
            ).lower()
            if query_l not in haystack:
                continue
        matched.append(localize_doc(pl, lang))

    # Optionally enrich via server-side Google Places API (New) when configured
    if include_google and query_l and len(matched) < 5:
        maps = get_maps_client()
        live = await maps.places_text_search(query=q)
        seen_ids = {m.get("google_place_id") for m in matched}
        for item in live:
            if item.get("google_place_id") not in seen_ids:
                matched.append(item)

    return {"items": matched}


@router.get("/places/{place_id}")
def get_place_detail(
    place_id: str,
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    pl = repo.get_doc("places", place_id)
    if not pl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
    out = localize_doc(pl, lang)
    if pl.get("permit_area_id"):
        area = repo.get_doc("permit_areas", pl["permit_area_id"])
        if area:
            out["permit_area_name"] = localize(area.get("name_i18n"), lang)
    return {"place": out}


@router.get("/saved-places")
def list_saved_places(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    items = repo.list_subdocs("user_profiles", user.uid, "saved_places", order_by="created_at", descending=True)
    return {"items": items}


@router.post("/saved-places")
def save_place(
    body: SavedPlaceRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    curated = repo.get_doc("places", body.place_id)
    payload = {
        "id": body.place_id,
        "place_id": body.place_id,
        "google_place_id": body.google_place_id or (curated or {}).get("google_place_id") or body.place_id,
        "title": body.title or localize((curated or {}).get("name_i18n"), user.preferred_lang) or body.place_id,
        "state_code": body.state_code or (curated or {}).get("state_code"),
        "lat": (curated or {}).get("lat"),
        "lng": (curated or {}).get("lng"),
        "note": body.note,
    }
    saved = repo.set_subdoc("user_profiles", user.uid, "saved_places", body.place_id, payload)
    return {"saved_place": saved}


@router.delete("/saved-places/{place_id}")
def unsave_place(
    place_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    deleted = repo.delete_subdoc("user_profiles", user.uid, "saved_places", place_id)
    return {"deleted": deleted, "place_id": place_id}


@router.get("/specialities")
def list_specialities(
    state: Optional[str] = Query(default=None),
    type: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = []
    if state:
        filters.append(("state_code", "==", state.upper()))
    if type and type != "all":
        filters.append(("type", "==", type))
    docs = repo.query_docs("specialities", filters=filters or None)
    return {"items": [localize_doc(d, lang) for d in docs]}


@router.get("/festivals")
def list_festivals(
    state: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    docs = repo.query_docs("festivals", filters=filters, order_by="start_date")
    return {"items": [localize_doc(d, lang) for d in docs]}


@router.get("/phrasebook")
def list_phrasebook(
    language_code: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = []
    if language_code and language_code != "all":
        filters.append(("language_code", "==", language_code))
    if category and category != "all":
        filters.append(("category", "==", category))
    docs = repo.query_docs("phrasebook", filters=filters or None)
    return {"items": docs}
