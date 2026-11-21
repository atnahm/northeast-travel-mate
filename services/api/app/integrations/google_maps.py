from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Optional

import httpx

from services.common.cache import get_cache
from services.common.config import get_settings
from services.common.geo import haversine_km


class GoogleMapsServerClient:
    """Server-side Google Maps Platform client (Places New, Routes v2, Geocoding) with TTL cache & curated fallback."""

    PLACES_BASE = "https://places.googleapis.com/v1"
    ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
    GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

    def _key(self) -> str:
        return (get_settings().google_maps_server_key or "").strip()

    @property
    def configured(self) -> bool:
        return bool(self._key())

    def _cache_key(self, prefix: str, payload: Any) -> str:
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]
        return f"cache:{prefix}:{digest}"

    async def places_text_search(
        self,
        query: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_m: int = 30000,
    ) -> List[Dict[str, Any]]:
        key = self._key()
        if not key:
            return []
        cache = get_cache()
        ck = self._cache_key("places", {"q": query, "lat": lat, "lng": lng, "r": radius_m})
        cached = cache.get_json(ck)
        if cached is not None:
            return cached

        body: Dict[str, Any] = {"textQuery": f"{query} North East India", "maxResultCount": 8}
        if lat is not None and lng is not None:
            body["locationBias"] = {
                "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius_m)}
            }
        headers = {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(f"{self.PLACES_BASE}/places:searchText", json=body, headers=headers)
                resp.raise_for_status()
                raw_places = resp.json().get("places", [])
        except Exception:
            return []

        results: List[Dict[str, Any]] = []
        for item in raw_places:
            loc = item.get("location") or {}
            results.append(
                {
                    "id": f"gplace_{item.get('id')}",
                    "google_place_id": item.get("id"),
                    "name": (item.get("displayName") or {}).get("text", "Place"),
                    "formatted_address": item.get("formattedAddress", ""),
                    "lat": loc.get("latitude"),
                    "lng": loc.get("longitude"),
                    "categories": item.get("types", [])[:3],
                    "source": "google_places",
                }
            )
        cache.set_json(ck, results, ttl_seconds=900)
        return results

    async def safety_nearby_search(self, lat: float, lng: float, kind: str = "hospital") -> List[Dict[str, Any]]:
        key = self._key()
        if not key:
            # Helpful fallback regional centers so safety page never fails offline/unconfigured
            fallback = [
                {
                    "id": "safe_gmch",
                    "name": "Gauhati Medical College & Hospital (GMCH)",
                    "kind": "hospital",
                    "address": "Bhangagarh, Guwahati, Assam",
                    "phone": "0361-2529457",
                    "lat": 26.1538,
                    "lng": 91.7695,
                },
                {
                    "id": "safe_shillong_civil",
                    "name": "Civil Hospital Shillong",
                    "kind": "hospital",
                    "address": "Lachumiere, Shillong, Meghalaya",
                    "phone": "0364-2224100",
                    "lat": 25.5689,
                    "lng": 91.8891,
                },
                {
                    "id": "safe_gangtok_stnm",
                    "name": "STNM Hospital (Sochyagang)",
                    "kind": "hospital",
                    "address": "Gangtok, Sikkim",
                    "phone": "03592-202011",
                    "lat": 27.3175,
                    "lng": 88.6020,
                },
                {
                    "id": "safe_kohima_naga",
                    "name": "Naga Hospital Authority Kohima",
                    "kind": "hospital",
                    "address": "Kohima, Nagaland",
                    "phone": "0370-2222916",
                    "lat": 25.6708,
                    "lng": 94.1077,
                },
                {
                    "id": "safe_panbazar_ps",
                    "name": "Panbazar Police Station & Tourist Desk",
                    "kind": "police",
                    "address": "Panbazar, Guwahati, Assam",
                    "phone": "112",
                    "lat": 26.1862,
                    "lng": 91.7445,
                },
            ]
            filtered = [f for f in fallback if kind in ("all", f["kind"])]
            for item in filtered:
                item["distance_km"] = round(haversine_km(lat, lng, item["lat"], item["lng"]), 1)
            filtered.sort(key=lambda x: x["distance_km"])
            return filtered

        cache = get_cache()
        ck = self._cache_key("safety", {"lat": round(lat, 3), "lng": round(lng, 3), "kind": kind})
        cached = cache.get_json(ck)
        if cached is not None:
            return cached

        included = ["hospital"] if kind == "hospital" else ["police"] if kind == "police" else ["hospital", "police"]
        body = {
            "includedTypes": included,
            "maxResultCount": 8,
            "locationRestriction": {
                "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 25000.0}
            },
        }
        headers = {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.types",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(f"{self.PLACES_BASE}/places:searchNearby", json=body, headers=headers)
                resp.raise_for_status()
                raw = resp.json().get("places", [])
        except Exception:
            return []

        results = []
        for item in raw:
            loc = item.get("location") or {}
            plat, plng = loc.get("latitude", lat), loc.get("longitude", lng)
            types = item.get("types", [])
            results.append(
                {
                    "id": item.get("id"),
                    "name": (item.get("displayName") or {}).get("text", "Emergency Help"),
                    "kind": "police" if "police" in types else "hospital",
                    "address": item.get("formattedAddress", ""),
                    "phone": item.get("nationalPhoneNumber", "112"),
                    "lat": plat,
                    "lng": plng,
                    "distance_km": round(haversine_km(lat, lng, plat, plng), 1),
                }
            )
        results.sort(key=lambda x: x["distance_km"])
        cache.set_json(ck, results, ttl_seconds=600)
        return results

    async def compute_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        waypoints: Optional[List[Dict[str, float]]] = None,
        travel_mode: str = "DRIVE",
    ) -> Dict[str, Any]:
        cache = get_cache()
        ck = self._cache_key(
            "routes",
            {
                "o": [round(origin_lat, 4), round(origin_lng, 4)],
                "d": [round(dest_lat, 4), round(dest_lng, 4)],
                "w": waypoints or [],
                "m": travel_mode,
            },
        )
        cached = cache.get_json(ck)
        if cached is not None:
            return cached

        key = self._key()
        if key:
            body: Dict[str, Any] = {
                "origin": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}},
                "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
                "travelMode": travel_mode,
                "routingPreference": "TRAFFIC_AWARE" if travel_mode == "DRIVE" else "ROUTING_PREFERENCE_UNSPECIFIED",
            }
            if waypoints:
                body["intermediates"] = [
                    {"location": {"latLng": {"latitude": w["lat"], "longitude": w["lng"]}}} for w in waypoints
                ]
            headers = {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
                "Content-Type": "application/json",
            }
            try:
                t0 = time.monotonic()
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(self.ROUTES_URL, json=body, headers=headers)
                    resp.raise_for_status()
                    routes = resp.json().get("routes", [])
                    if routes:
                        r = routes[0]
                        duration_s = int(str(r.get("duration", "0s")).rstrip("s") or 0)
                        dist_km = round(r.get("distanceMeters", 0) / 1000.0, 1)
                        res = {
                            "source": "google_routes",
                            "distance_km": dist_km,
                            "duration_min": max(1, round(duration_s / 60)),
                            "encoded_polyline": (r.get("polyline") or {}).get("encodedPolyline"),
                            "path": [{"lat": origin_lat, "lng": origin_lng}, *(waypoints or []), {"lat": dest_lat, "lng": dest_lng}],
                            "latency_ms": int((time.monotonic() - t0) * 1000),
                        }
                        cache.set_json(ck, res, ttl_seconds=900)
                        return res
            except Exception:
                pass

        # Hill-road realistic distance/time estimator when server key isn't configured or offline
        straight_km = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
        road_km = round(straight_km * 1.38, 1)
        avg_speed_kmh = 34.0 if travel_mode == "DRIVE" else 28.0
        duration_min = max(15, int(round((road_km / avg_speed_kmh) * 60)))
        res = {
            "source": "hill_route_estimate",
            "distance_km": road_km,
            "duration_min": duration_min,
            "encoded_polyline": None,
            "path": [{"lat": origin_lat, "lng": origin_lng}, *(waypoints or []), {"lat": dest_lat, "lng": dest_lng}],
        }
        cache.set_json(ck, res, ttl_seconds=600)
        return res


_maps_client = GoogleMapsServerClient()


def get_maps_client() -> GoogleMapsServerClient:
    return _maps_client
