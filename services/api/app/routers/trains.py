from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from services.api.app.deps.auth import AuthUser, get_optional_user, get_repo_dep
from services.api.app.services.train_service import (
    get_live_status_service,
    get_permit_hint_for_destination,
    get_train_route_service,
    search_trains_service,
    validate_journey_date,
    validate_train_no,
)
from services.common.cache import get_cache
from services.common.repository import BaseNoSQLRepo
from services.common.train_data import destinations, search_local, stations

router = APIRouter(prefix="/api/v1/trains", tags=["trains"])


def _enforce_train_rate_limit(request: Request, user: Optional[AuthUser], bucket_name: str, max_rpm: int = 30) -> None:
    ident = user.uid if user else (request.client.host if request.client else "unknown")
    allowed, _ = get_cache().check_rate_limit(f"rl:trains:{bucket_name}:{ident}", max_requests=max_rpm, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many train requests. Please wait a minute and try again.",
        )


@router.get("/stations")
def search_stations_local(
    q: str = Query(default="", max_length=60),
    limit: int = Query(default=10, ge=1, le=25),
    user: Optional[AuthUser] = Depends(get_optional_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    """Local-only autocomplete (ne-railheads.json + stations-nfr.json). Zero external API calls."""
    profile = repo.get_doc("user_profiles", user.uid) if user else None
    citizen_type = (profile or {}).get("citizen_type", "indian")

    items = search_local(q, limit=limit) if q.strip() else []
    for item in items:
        if item.get("kind") == "place":
            item["permitHint"] = get_permit_hint_for_destination(
                repo,
                state_code=item.get("stateCode"),
                permit_area_id=item.get("permitAreaId"),
                citizen_type=citizen_type,
            )
    return {"items": items}


@router.get("/railheads")
def get_railheads_bundle(
    user: Optional[AuthUser] = Depends(get_optional_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    """Return full local railheads + NFR stations + verified permit hints for client-side zero-API autocomplete."""
    profile = repo.get_doc("user_profiles", user.uid) if user else None
    citizen_type = (profile or {}).get("citizen_type", "indian")
    cache = get_cache()
    cache_key = f"trains:railheads:{citizen_type}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    st_list = stations()
    st_map = {s["code"]: s for s in st_list}
    dest_out = []
    for d in destinations():
        heads = []
        for rh in d.get("railheads", []):
            st = st_map.get(rh["code"], {})
            heads.append({**rh, "name": st.get("name", rh["code"]), "lat": st.get("lat"), "lng": st.get("lng")})
        dest_out.append({
            **d,
            "railheads": heads,
            "permitHint": get_permit_hint_for_destination(
                repo,
                state_code=d.get("stateCode"),
                permit_area_id=d.get("permitAreaId"),
                citizen_type=citizen_type,
            ),
        })
    payload = {"stations": st_list, "destinations": dest_out}
    cache.set_json(cache_key, payload, ttl_seconds=1800)
    return payload


@router.get("/search")
async def search_trains(
    request: Request,
    from_code: str = Query(..., alias="from", min_length=2, max_length=6),
    to_code: str = Query(..., alias="to", min_length=2, max_length=6),
    date_str: Optional[str] = Query(default=None, alias="date"),
    user: Optional[AuthUser] = Depends(get_optional_user),
) -> dict:
    _enforce_train_rate_limit(request, user, "search", max_rpm=30)
    try:
        jdate = validate_journey_date(date_str, allow_yesterday=False)
        return await search_trains_service(from_code, to_code, jdate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc


@router.get("/{train_no}/route")
async def train_route(
    train_no: str,
    request: Request,
    user: Optional[AuthUser] = Depends(get_optional_user),
) -> dict:
    _enforce_train_rate_limit(request, user, "route", max_rpm=30)
    try:
        num = validate_train_no(train_no)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    result = await get_train_route_service(num)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No route schedule found for train {num}.",
        )
    return result


@router.get("/{train_no}/status")
async def train_live_status(
    train_no: str,
    request: Request,
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    user: Optional[AuthUser] = Depends(get_optional_user),
) -> dict:
    _enforce_train_rate_limit(request, user, "status", max_rpm=20)
    try:
        num = validate_train_no(train_no)
        sdate = validate_journey_date(start_date, allow_yesterday=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    return await get_live_status_service(num, sdate)
