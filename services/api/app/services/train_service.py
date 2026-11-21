"""Business logic for train search, route, live status, caching, fallback & permit hints."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from services.api.app.integrations.railway import (
    ProviderError,
    ProviderNotConfigured,
    ProviderQuotaExceeded,
    RailwayProvider,
    get_railway_provider,
)
from services.common.cache import CacheClient, get_cache
from services.common.permit_engine import build_permit_checklist
from services.common.repository import BaseNoSQLRepo
from services.common.train_data import fallback, station_by_code
from services.common.trains import (
    DISCLAIMER,
    LiveStatus,
    TrainRoute,
    TrainStop,
    TrainSummary,
    iso_ist,
    now_ist_iso,
    parse_hhmm,
    runs_on_date,
    today_ist,
    weekday_code,
)

TRAIN_NO_RE = re.compile(r"^\d{5}$")
STATION_CODE_RE = re.compile(r"^[A-Z0-9]{2,6}$")

SEARCH_CACHE_TTL_SEC = 24 * 3600  # 24 hours by from:to:weekday
ROUTE_CACHE_TTL_SEC = 24 * 3600
LIVE_STATUS_CACHE_TTL_SEC = 10 * 60  # 10 minutes by trainNo:startDate


def validate_train_no(train_no: str) -> str:
    clean = train_no.strip()
    if not TRAIN_NO_RE.match(clean):
        raise ValueError("Train number must be exactly 5 digits (for example 12067).")
    return clean


def validate_station_code(code: str) -> str:
    clean = code.strip().upper()
    if not STATION_CODE_RE.match(clean):
        raise ValueError(f"Invalid station code: {code}")
    return clean


def validate_journey_date(date_str: Optional[str], allow_yesterday: bool = False) -> date:
    if not date_str:
        return today_ist()
    try:
        parsed = date.fromisoformat(date_str[:10])
    except ValueError as exc:
        raise ValueError("Date must be in YYYY-MM-DD format.") from exc
    min_allowed = today_ist()
    if allow_yesterday:
        from datetime import timedelta

        min_allowed = min_allowed - timedelta(days=1)
    if parsed < min_allowed:
        raise ValueError("Date cannot be in the past.")
    return parsed


def _compute_duration_and_offset(dep_hhmm: str, dep_day: int, arr_hhmm: str, arr_day: int) -> tuple[int, int]:
    dt_dep = parse_hhmm(dep_hhmm)
    dt_arr = parse_hhmm(arr_hhmm)
    if not dt_dep or not dt_arr:
        return 0, max(0, arr_day - dep_day)
    dep_mins = (dep_day - 1) * 1440 + dt_dep.hour * 60 + dt_dep.minute
    arr_mins = (arr_day - 1) * 1440 + dt_arr.hour * 60 + dt_arr.minute
    if arr_mins < dep_mins:
        arr_mins += 1440
    total = arr_mins - dep_mins
    offset = (dt_dep.hour * 60 + dt_dep.minute + total) // 1440
    return total, offset


def _fallback_search(from_code: str, to_code: str, journey_date: date) -> Dict[str, Any]:
    fb = fallback()
    verified_at = fb.get("verifiedAt")
    source_label = fb.get("source") or "Scheduled NFR timetable"
    matches: List[TrainSummary] = []

    for tr in fb.get("trains", []):
        stops = tr.get("stops", [])
        from_idx = next((i for i, s in enumerate(stops) if s["stationCode"] == from_code), None)
        to_idx = next((i for i, s in enumerate(stops) if s["stationCode"] == to_code), None)
        if from_idx is None or to_idx is None or from_idx >= to_idx:
            continue
        origin = stops[from_idx]
        dest = stops[to_idx]
        dep_hhmm = origin.get("schedDep") or origin.get("schedArr") or "00:00"
        arr_hhmm = dest.get("schedArr") or dest.get("schedDep") or "00:00"
        dep_day = int(origin.get("day", 1))
        arr_day = int(dest.get("day", dep_day))
        duration_min, day_offset = _compute_duration_and_offset(dep_hhmm, dep_day, arr_hhmm, arr_day)
        runs_on = tr.get("runsOn", [])
        matches.append(
            TrainSummary(
                train_no=tr["trainNo"],
                name=tr["name"],
                type=tr.get("type", "Express"),
                from_code=from_code,
                to_code=to_code,
                departure=iso_ist(journey_date, dep_hhmm, 0) or "",
                arrival=iso_ist(journey_date, arr_hhmm, day_offset) or "",
                duration_min=duration_min,
                arrival_day_offset=day_offset,
                runs_on=runs_on,
                runs_on_selected_date=runs_on_date(runs_on, journey_date),
                classes=tr.get("classes", []),
                source="scheduled_fallback",
                fetched_at=verified_at,
                provider=source_label,
            )
        )

    # Sort: trains running on selected date first, then by departure time
    matches.sort(key=lambda t: (t.runs_on_selected_date is False, t.departure))
    return {
        "fromCode": from_code,
        "toCode": to_code,
        "date": journey_date.isoformat(),
        "sameRailhead": False,
        "source": "scheduled_fallback",
        "verifiedAt": verified_at,
        "provider": source_label,
        "trains": [m.wire() for m in matches],
    }


def _fallback_route(train_no: str, base_day: Optional[date] = None) -> Optional[TrainRoute]:
    fb = fallback()
    tr = next((t for t in fb.get("trains", []) if t["trainNo"] == train_no), None)
    if not tr:
        return None
    ref_day = base_day or today_ist()
    stops: List[TrainStop] = []
    for s in tr.get("stops", []):
        day_num = int(s.get("day", 1))
        arr = parse_hhmm(s.get("schedArr"))
        dep = parse_hhmm(s.get("schedDep"))
        halt_min = None
        if arr and dep:
            diff = (dep.hour * 60 + dep.minute) - (arr.hour * 60 + arr.minute)
            halt_min = diff if diff >= 0 else diff + 1440
        stops.append(
            TrainStop(
                station_code=s["stationCode"],
                station_name=s["stationName"],
                distance_km=s.get("distanceKm"),
                sched_arr=iso_ist(ref_day, s.get("schedArr"), day_num - 1),
                sched_dep=iso_ist(ref_day, s.get("schedDep"), day_num - 1),
                exp_arr=None,
                exp_dep=None,
                delay_min=None,
                halt_min=halt_min,
                platform=None,
                passed=False,
            )
        )
    return TrainRoute(
        train_no=tr["trainNo"],
        name=tr["name"],
        type=tr.get("type", "Express"),
        stops=stops,
        source="scheduled_fallback",
        fetched_at=fb.get("verifiedAt"),
        provider=fb.get("source") or "Scheduled NFR timetable",
    )


async def search_trains_service(
    from_code: str,
    to_code: str,
    journey_date: date,
    provider: Optional[RailwayProvider] = None,
    cache: Optional[CacheClient] = None,
) -> Dict[str, Any]:
    fc = validate_station_code(from_code)
    tc = validate_station_code(to_code)

    # Same-railhead trips make ZERO provider calls
    if fc == tc:
        return {
            "fromCode": fc,
            "toCode": tc,
            "date": journey_date.isoformat(),
            "sameRailhead": True,
            "source": "cached",
            "verifiedAt": None,
            "provider": "local",
            "trains": [],
        }

    c = cache or get_cache()
    wk = weekday_code(journey_date)
    cache_key = f"trains:search:{fc}:{tc}:{wk}"
    cached = c.get_json(cache_key)
    if cached is not None:
        # Re-tag items as cached & preserve date
        items = [{**item, "source": "cached" if item.get("source") == "live" else item.get("source")} for item in cached.get("trains", [])]
        return {**cached, "date": journey_date.isoformat(), "source": "cached" if cached.get("source") == "live" else cached.get("source"), "trains": items}

    prov = provider or get_railway_provider()
    try:
        live_trains = await prov.search_trains(fc, tc, journey_date)
        live_trains.sort(key=lambda t: (t.runs_on_selected_date is False, t.departure))
        payload = {
            "fromCode": fc,
            "toCode": tc,
            "date": journey_date.isoformat(),
            "sameRailhead": False,
            "source": "live",
            "verifiedAt": now_ist_iso(),
            "provider": prov.name,
            "trains": [t.wire() for t in live_trains],
            "disclaimer": DISCLAIMER.format(provider=prov.name),
        }
        c.set_json(cache_key, payload, ttl_seconds=SEARCH_CACHE_TTL_SEC)
        return payload
    except (ProviderNotConfigured, ProviderQuotaExceeded, ProviderError) as exc:
        fb_res = _fallback_search(fc, tc, journey_date)
        fb_res["fallbackReason"] = str(exc)
        return fb_res


async def get_train_route_service(
    train_no: str,
    provider: Optional[RailwayProvider] = None,
    cache: Optional[CacheClient] = None,
) -> Optional[Dict[str, Any]]:
    num = validate_train_no(train_no)
    c = cache or get_cache()
    cache_key = f"trains:route:{num}"
    cached = c.get_json(cache_key)
    if cached is not None:
        return {**cached, "source": "cached" if cached.get("source") == "live" else cached.get("source")}

    prov = provider or get_railway_provider()
    try:
        route = await prov.get_train_route(num)
        payload = route.wire()
        c.set_json(cache_key, payload, ttl_seconds=ROUTE_CACHE_TTL_SEC)
        return payload
    except (ProviderNotConfigured, ProviderQuotaExceeded, ProviderError):
        fb_route = _fallback_route(num)
        return fb_route.wire() if fb_route else None


async def get_live_status_service(
    train_no: str,
    start_date: date,
    provider: Optional[RailwayProvider] = None,
    cache: Optional[CacheClient] = None,
) -> Dict[str, Any]:
    num = validate_train_no(train_no)
    c = cache or get_cache()
    cache_key = f"trains:status:{num}:{start_date.isoformat()}"
    cached = c.get_json(cache_key)
    if cached is not None:
        return {
            **cached,
            "source": "cached" if cached.get("source") == "live" else cached.get("source"),
            "disclaimer": DISCLAIMER.format(provider=cached.get("provider", "provider")),
        }

    prov = provider or get_railway_provider()
    try:
        live = await prov.get_live_status(num, start_date)
        payload = live.wire()
        payload["disclaimer"] = DISCLAIMER.format(provider=prov.name)
        c.set_json(cache_key, payload, ttl_seconds=LIVE_STATUS_CACHE_TTL_SEC)
        return payload
    except (ProviderNotConfigured, ProviderQuotaExceeded, ProviderError) as exc:
        # NEVER fabricate "On Time", delay, or platform. Return honest state='unavailable' + scheduled stops if known.
        fb_route = _fallback_route(num, base_day=start_date)
        fb = fallback()
        unavailable = LiveStatus(
            train_no=num,
            start_date=start_date.isoformat(),
            state="unavailable",
            current_station_code=None,
            next_station_code=None,
            delay_min=None,
            stops=fb_route.stops if fb_route else [],
            fetched_at=fb.get("verifiedAt"),
            provider=fb.get("source") or "Scheduled timetable (not live)",
            source="scheduled_fallback",
            message=f"Live status unavailable ({exc}). Showing scheduled timetable only." if fb_route else f"Live status unavailable ({exc}).",
        )
        payload = unavailable.wire()
        payload["trainName"] = fb_route.name if fb_route else None
        payload["trainType"] = fb_route.type if fb_route else None
        payload["disclaimer"] = "Scheduled timetable, not live. Confirm running status on Indian Railways / NTES before you travel."
        return payload


def get_permit_hint_for_destination(
    repo: BaseNoSQLRepo,
    state_code: Optional[str],
    permit_area_id: Optional[str] = None,
    citizen_type: str = "indian",
) -> Optional[Dict[str, Any]]:
    """Query the verified permits DB — never hard-coded in ne-railheads.json."""
    if not state_code and not permit_area_id:
        return None
    checklist = build_permit_checklist(
        repo=repo,
        citizen_type=citizen_type,
        state_code=state_code,
        destination_id=permit_area_id,
    )
    required_items = [it for it in checklist.get("items", []) if it.get("required")]
    if not required_items:
        return None
    return {
        "mayRequirePermit": True,
        "stateCode": state_code,
        "permitAreaId": permit_area_id,
        "count": len(required_items),
        "permitsPath": f"/permits?state={state_code or ''}" + (f"&destination_id={permit_area_id}" if permit_area_id else ""),
    }
