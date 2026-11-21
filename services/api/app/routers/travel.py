from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from services.api.app.deps.auth import get_repo_dep
from services.api.app.integrations.google_maps import get_maps_client
from services.api.app.models.schemas import RouteCalcRequest, TravelOptionsRequest
from services.common.geo import haversine_km
from services.common.i18n import localize, localize_doc
from services.common.repository import BaseNoSQLRepo

router = APIRouter(prefix="/api/v1", tags=["travel"])


def _resolve_node_or_place(repo: BaseNoSQLRepo, ref_id: Optional[str], name: Optional[str], lat: Optional[float], lng: Optional[float]) -> Optional[Dict[str, Any]]:
    if ref_id:
        node = repo.get_doc("transport_nodes", ref_id)
        if node:
            return node
        place = repo.get_doc("places", ref_id)
        if place:
            return place
    if name:
        q = name.strip().lower()
        for col in ("transport_nodes", "places"):
            for doc in repo.list_docs(col):
                en_name = localize(doc.get("name_i18n"), "en").lower()
                code = str(doc.get("code", "")).lower()
                if q in en_name or q == code:
                    return doc
    if lat is not None and lng is not None:
        return {"id": "custom_point", "name_i18n": {"en": name or "Selected Map Point"}, "lat": lat, "lng": lng, "state_code": ""}
    return None


@router.get("/transport/nodes")
def search_transport_nodes(
    q: str = Query(default=""),
    state: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    nodes = repo.query_docs("transport_nodes", filters=filters)
    ql = q.strip().lower()
    out = []
    for n in nodes:
        if ql:
            text = f"{localize(n.get('name_i18n'), 'en')} {n.get('code', '')} {n.get('state_code', '')}".lower()
            if ql not in text:
                continue
        out.append(localize_doc(n, lang))
    return {"items": out}


@router.post("/travel/options")
async def travel_options(
    body: TravelOptionsRequest,
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    origin = _resolve_node_or_place(repo, body.from_id, body.from_name, body.from_lat, body.from_lng)
    dest = _resolve_node_or_place(repo, body.to_id, body.to_name, body.to_lat, body.to_lng)

    if not origin or not dest:
        # Return curated options matching any provided filter
        all_opts = repo.list_docs("transport_options")
        return {"origin": origin, "destination": dest, "options": all_opts[:8], "route": None}

    # Look for curated transport_options between matched nodes (either direction)
    all_opts = repo.list_docs("transport_options")
    nodes = {n["id"]: n for n in repo.list_docs("transport_nodes")}
    direct_opts: List[Dict[str, Any]] = []
    for opt in all_opts:
        f_node = nodes.get(opt["from_node_id"])
        t_node = nodes.get(opt["to_node_id"])
        match_ids = opt["from_node_id"] == origin.get("id") and opt["to_node_id"] == dest.get("id")
        match_states = (
            f_node
            and t_node
            and origin.get("state_code")
            and dest.get("state_code")
            and f_node.get("state_code") == origin.get("state_code")
            and t_node.get("state_code") == dest.get("state_code")
            and haversine_km(origin["lat"], origin["lng"], f_node["lat"], f_node["lng"]) < 45
            and haversine_km(dest["lat"], dest["lng"], t_node["lat"], t_node["lng"]) < 45
        )
        if match_ids or match_states:
            direct_opts.append(
                {
                    **opt,
                    "from_name": localize((f_node or {}).get("name_i18n"), lang),
                    "to_name": localize((t_node or {}).get("name_i18n"), lang),
                    "curated": True,
                }
            )

    # Compute road geometry/duration via Google Routes API (or hill-road estimate fallback)
    maps = get_maps_client()
    route_info = await maps.compute_route(origin["lat"], origin["lng"], dest["lat"], dest["lng"])
    dist_km = route_info["distance_km"]
    dur_min = route_info["duration_min"]

    # Always provide self-drive & shared Sumo comparison cards if not already present in curated list
    modes_present = {o["mode"] for o in direct_opts}
    if "shared_sumo" not in modes_present and dist_km < 600:
        direct_opts.append(
            {
                "id": f"est_sumo_{origin['id']}_{dest['id']}",
                "mode": "shared_sumo",
                "operator": "Regional Shared Sumo / Cruiser Stand",
                "from_name": localize(origin.get("name_i18n"), lang),
                "to_name": localize(dest.get("name_i18n"), lang),
                "distance_km": dist_km,
                "typical_duration_min": int(dur_min * 1.12),
                "fare_min_inr": max(150, int(round(dist_km * 3.0, -1))),
                "fare_max_inr": max(250, int(round(dist_km * 4.8, -1))),
                "schedule_text": "Morning shared departures (confirm stand timings locally)",
                "permit_checkpoints": ["Check state/ILP entry gates along route"],
                "warnings": ["Verify road conditions and fuel/ATM availability before hill climbs."],
                "last_verified_at": "Estimated via route model",
                "curated": False,
            }
        )
    if "self_drive" not in modes_present:
        direct_opts.append(
            {
                "id": f"est_drive_{origin['id']}_{dest['id']}",
                "mode": "self_drive",
                "operator": "Private Cab / Self-Drive via Highway",
                "from_name": localize(origin.get("name_i18n"), lang),
                "to_name": localize(dest.get("name_i18n"), lang),
                "distance_km": dist_km,
                "typical_duration_min": dur_min,
                "fare_min_inr": max(900, int(round(dist_km * 14.0, -2))),
                "fare_max_inr": max(1500, int(round(dist_km * 22.0, -2))),
                "schedule_text": "Flexible; daylight mountain driving strongly recommended",
                "permit_checkpoints": ["Check state/ILP entry gates along route"],
                "warnings": ["Download offline state pack; mobile data drops on ridge stretches."],
                "last_verified_at": route_info.get("source", "route_estimate"),
                "curated": False,
            }
        )

    return {
        "origin": localize_doc(origin, lang),
        "destination": localize_doc(dest, lang),
        "date": body.date,
        "route": route_info,
        "options": direct_opts,
    }


@router.post("/travel/route")
async def compute_travel_route(body: RouteCalcRequest) -> dict:
    maps = get_maps_client()
    return await maps.compute_route(
        body.origin_lat,
        body.origin_lng,
        body.dest_lat,
        body.dest_lng,
        waypoints=body.waypoints,
        travel_mode=body.travel_mode,
    )


# Train endpoints now live in routers/trains.py (/api/v1/trains/*).
