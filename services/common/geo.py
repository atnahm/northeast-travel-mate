from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence

from services.common.repository import BaseNoSQLRepo

_GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz"


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two WGS84 points in kilometers."""
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def encode_geohash(lat: float, lng: float, precision: int = 6) -> str:
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    geohash: List[str] = []
    bits = 0
    bit = 0
    even = True
    while len(geohash) < precision:
        if even:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                bit = (bit << 1) + 1
                lng_range[0] = mid
            else:
                bit = bit << 1
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                bit = (bit << 1) + 1
                lat_range[0] = mid
            else:
                bit = bit << 1
                lat_range[1] = mid
        even = not even
        bits += 1
        if bits == 5:
            geohash.append(_GEOHASH_ALPHABET[bit])
            bits = 0
            bit = 0
    return "".join(geohash)


def point_in_bbox(lat: float, lng: float, bbox: Optional[Dict[str, float]]) -> bool:
    if not bbox:
        return False
    return (
        bbox["min_lat"] <= lat <= bbox["max_lat"]
        and bbox["min_lng"] <= lng <= bbox["max_lng"]
    )


def point_in_polygon(lat: float, lng: float, ring: Sequence[Sequence[float]]) -> bool:
    """Ray-casting point-in-polygon test. Ring points are [lat, lng] pairs."""
    if len(ring) < 3:
        return False
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        yi, xi = ring[i][0], ring[i][1]
        yj, xj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def area_contains_point(area: Dict[str, Any], lat: float, lng: float) -> bool:
    polygon = area.get("polygon")
    if polygon:
        return point_in_polygon(lat, lng, polygon)
    return point_in_bbox(lat, lng, area.get("bbox"))


def resolve_permit_areas(
    repo: BaseNoSQLRepo,
    destination_id: Optional[str] = None,
    state_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Resolve a destination (area ID, place ID, state code, or coordinates) to matching permit_areas
    plus all ancestor parent areas (replacing SQL/PostGIS containment).
    """
    all_areas = repo.list_docs("permit_areas")
    by_id = {a["id"]: a for a in all_areas}
    matched_ids: List[str] = []

    if destination_id:
        # Check if destination_id is directly a permit_area id
        if destination_id in by_id:
            matched_ids.append(destination_id)
        else:
            # Check if destination_id is a place id
            place = repo.get_doc("places", destination_id)
            if place:
                if place.get("permit_area_id") and place["permit_area_id"] in by_id:
                    matched_ids.append(place["permit_area_id"])
                if place.get("lat") is not None and place.get("lng") is not None:
                    lat, lng = place["lat"], place["lng"]
                state_code = state_code or place.get("state_code")
            elif destination_id.upper() in {a.get("state_code") for a in all_areas}:
                state_code = destination_id.upper()

    if lat is not None and lng is not None:
        for area in all_areas:
            if area_contains_point(area, lat, lng) and area["id"] not in matched_ids:
                matched_ids.append(area["id"])

    if state_code:
        sc = state_code.upper().strip()
        for area in all_areas:
            if area.get("state_code") == sc and area.get("kind") == "state" and area["id"] not in matched_ids:
                matched_ids.append(area["id"])
        # If no specific sub-area matched, include state-level area; if state_code was passed explicitly without coords, include state area
        if not matched_ids:
            for area in all_areas:
                if area.get("state_code") == sc and area["id"] not in matched_ids:
                    matched_ids.append(area["id"])

    # Walk parent_id / ancestor_ids to ensure hierarchical coverage
    expanded: List[Dict[str, Any]] = []
    seen = set()

    def _add_with_ancestors(area_id: str) -> None:
        if area_id in seen or area_id not in by_id:
            return
        area = by_id[area_id]
        seen.add(area_id)
        expanded.append(area)
        parent_id = area.get("parent_id")
        if parent_id:
            _add_with_ancestors(parent_id)
        for anc_id in area.get("ancestor_ids") or []:
            _add_with_ancestors(anc_id)

    for mid in matched_ids:
        _add_with_ancestors(mid)

    # Sort specificity: sub-areas first, state areas after
    kind_rank = {"protected_area": 0, "border_zone": 0, "lake": 0, "trek": 0, "district": 1, "subdivision": 1, "state": 2}
    expanded.sort(key=lambda a: kind_rank.get(a.get("kind", "state"), 2))
    return expanded
