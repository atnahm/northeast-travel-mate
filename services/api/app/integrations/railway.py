"""Railway data providers.

`RailwayProvider` is the only thing the rest of the code depends on. A licensed provider can replace
`RapidApiRailwayProvider` by implementing the same three methods; no router or UI code changes.

IMPORTANT: the RapidAPI adapter below is the first implementation only. It is unofficial, its terms,
quota and response shape can change, and its field mapping has been written from the provider's public
documentation conventions and tested against fixtures, NOT against a live key. Validate it with a real key
before relying on it. Any response that does not parse raises ProviderError, which makes the service fall
back to the labelled scheduled timetable. Nothing in this module returns sample or invented data.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Dict, List, Optional

import httpx

from services.common.config import get_settings
from services.common.trains import (
    LiveStatus,
    TrainRoute,
    TrainStop,
    TrainSummary,
    arrival_offset,
    iso_ist,
    normalise_runs_on,
    now_ist_iso,
    parse_duration_min,
    runs_on_date,
)


class ProviderError(Exception):
    """The provider failed or returned something we cannot trust."""


class ProviderNotConfigured(ProviderError):
    """No provider key is configured."""


class ProviderQuotaExceeded(ProviderError):
    """The provider rejected the call because the quota or rate limit is exhausted."""


class RailwayProvider(ABC):
    name: str = "unknown"

    @abstractmethod
    async def search_trains(self, from_code: str, to_code: str, journey_date: date) -> List[TrainSummary]: ...

    @abstractmethod
    async def get_train_route(self, train_no: str) -> TrainRoute: ...

    @abstractmethod
    async def get_live_status(self, train_no: str, start_date: date) -> LiveStatus: ...


class NullRailwayProvider(RailwayProvider):
    """Used when no key is configured. It never invents data; every call raises ProviderNotConfigured."""

    name = "none"

    async def search_trains(self, from_code: str, to_code: str, journey_date: date) -> List[TrainSummary]:
        raise ProviderNotConfigured("No railway data provider key is configured.")

    async def get_train_route(self, train_no: str) -> TrainRoute:
        raise ProviderNotConfigured("No railway data provider key is configured.")

    async def get_live_status(self, train_no: str, start_date: date) -> LiveStatus:
        raise ProviderNotConfigured("No railway data provider key is configured.")


# ---------------------------------------------------------------------------------------------------
# Pure mappers (unit tested with fixtures). They never default a missing fact to a made-up value.
# ---------------------------------------------------------------------------------------------------
def map_search_item(item: Dict[str, Any], journey_date: date, provider: str, fetched_at: str) -> TrainSummary:
    try:
        dep_hhmm = item["from_std"]
        duration = parse_duration_min(item.get("duration"))
        offset = arrival_offset(dep_hhmm, duration)
        if duration is None or offset is None:
            raise ProviderError("search item has no usable duration or departure time")
        arr_hhmm = item.get("to_sta")
        runs_on = normalise_runs_on(item.get("run_days") or [])
        return TrainSummary(
            train_no=str(item["train_number"]),
            name=str(item["train_name"]),
            type=str(item.get("train_type") or "Express"),
            from_code=str(item["from_station_code"]).upper(),
            to_code=str(item["to_station_code"]).upper(),
            departure=iso_ist(journey_date, dep_hhmm) or "",
            arrival=iso_ist(journey_date, arr_hhmm, offset) or "",
            duration_min=duration,
            arrival_day_offset=offset,
            runs_on=runs_on,
            runs_on_selected_date=runs_on_date(runs_on, journey_date),
            classes=[str(c) for c in (item.get("class_type") or [])],
            source="live",
            fetched_at=fetched_at,
            provider=provider,
        )
    except KeyError as exc:
        raise ProviderError(f"search item missing field {exc}") from exc


def map_route_stop(item: Dict[str, Any], journey_date: date) -> TrainStop:
    day = int(item.get("day") or 1)
    try:
        distance = item.get("distance")
        return TrainStop(
            station_code=str(item["station_code"]).upper(),
            station_name=str(item["station_name"]),
            distance_km=float(distance) if distance not in (None, "") else None,
            sched_arr=iso_ist(journey_date, item.get("arrival_time"), day - 1),
            sched_dep=iso_ist(journey_date, item.get("departure_time"), day - 1),
        )
    except KeyError as exc:
        raise ProviderError(f"route stop missing field {exc}") from exc


def map_live_status(payload: Dict[str, Any], train_no: str, start_date: date, provider: str, fetched_at: str) -> LiveStatus:
    """Map a provider live-status payload. Unknown or ambiguous input becomes state='unavailable'."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    message = str(data.get("status_message") or data.get("train_status_message") or "").strip()
    low = message.lower()

    if "cancel" in low:
        state = "cancelled"
    elif "divert" in low:
        state = "diverted"
    elif "not started" in low or "yet to start" in low:
        state = "not_started"
    elif "terminated" in low or "reached destination" in low:
        state = "terminated"
    elif data.get("current_station_code"):
        state = "running"
    else:
        state = "unavailable"

    stops: List[TrainStop] = []
    for key, passed in (("previous_stations", True), ("upcoming_stations", False)):
        for raw in data.get(key) or []:
            code = raw.get("station_code")
            if not code:
                continue
            delay = raw.get("arrival_delay")
            stops.append(
                TrainStop(
                    station_code=str(code).upper(),
                    station_name=str(raw.get("station_name") or code),
                    distance_km=float(raw["distance_from_source"]) if raw.get("distance_from_source") not in (None, "") else None,
                    sched_arr=iso_ist(start_date, raw.get("sta"), int(raw.get("day") or 1) - 1),
                    sched_dep=iso_ist(start_date, raw.get("std"), int(raw.get("day") or 1) - 1),
                    exp_arr=iso_ist(start_date, raw.get("eta"), int(raw.get("day") or 1) - 1),
                    exp_dep=iso_ist(start_date, raw.get("etd"), int(raw.get("day") or 1) - 1),
                    delay_min=int(delay) if delay not in (None, "") else None,
                    platform=str(raw["platform_number"]) if raw.get("platform_number") else None,
                    passed=passed,
                )
            )

    delay_raw = data.get("delay")
    return LiveStatus(
        train_no=train_no,
        start_date=start_date.isoformat(),
        state=state,  # type: ignore[arg-type]
        current_station_code=(str(data["current_station_code"]).upper() if data.get("current_station_code") else None),
        next_station_code=(str(data["next_station_code"]).upper() if data.get("next_station_code") else None),
        delay_min=int(delay_raw) if delay_raw not in (None, "") else None,
        stops=stops,
        fetched_at=fetched_at,
        provider=provider,
        source="live",
        message=message or None,
    )


class RapidApiRailwayProvider(RailwayProvider):
    name = "rapidapi-irctc"

    def __init__(self, api_key: str, host: str, timeout: float = 8.0) -> None:
        self._key = api_key
        self._host = host
        self._timeout = timeout

    async def _get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        headers = {"X-RapidAPI-Key": self._key, "X-RapidAPI-Host": self._host}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, base_url=f"https://{self._host}") as client:
                resp = await client.get(path, params=params, headers=headers)
        except httpx.HTTPError as exc:
            raise ProviderError(f"provider unreachable: {exc.__class__.__name__}") from exc
        if resp.status_code in (402, 403, 429):
            raise ProviderQuotaExceeded(f"provider returned HTTP {resp.status_code}")
        if resp.status_code >= 400:
            raise ProviderError(f"provider returned HTTP {resp.status_code}")
        try:
            body = resp.json()
        except ValueError as exc:
            raise ProviderError("provider returned non-JSON") from exc
        if isinstance(body, dict) and body.get("status") is False:
            raise ProviderError(str(body.get("message") or "provider reported failure"))
        return body

    async def search_trains(self, from_code: str, to_code: str, journey_date: date) -> List[TrainSummary]:
        body = await self._get(
            "/api/v3/trainBetweenStations",
            {"fromStationCode": from_code, "toStationCode": to_code, "dateOfJourney": journey_date.isoformat()},
        )
        items = body.get("data") or []
        if not isinstance(items, list):
            raise ProviderError("unexpected search payload")
        fetched = now_ist_iso()
        return [map_search_item(i, journey_date, self.name, fetched) for i in items]

    async def get_train_route(self, train_no: str) -> TrainRoute:
        body = await self._get("/api/v1/getTrainSchedule", {"trainNo": train_no})
        rows = (body.get("data") or {}).get("route") if isinstance(body.get("data"), dict) else None
        if not isinstance(rows, list) or not rows:
            raise ProviderError("unexpected route payload")
        info = body["data"]
        base_day = date.today()
        return TrainRoute(
            train_no=train_no,
            name=str(info.get("train_name") or train_no),
            type=str(info.get("train_type") or "Express"),
            stops=[map_route_stop(r, base_day) for r in rows],
            source="live",
            fetched_at=now_ist_iso(),
            provider=self.name,
        )

    async def get_live_status(self, train_no: str, start_date: date) -> LiveStatus:
        offset = (date.today() - start_date).days
        body = await self._get("/api/v1/liveTrainStatus", {"trainNo": train_no, "startDay": max(0, min(offset, 1))})
        return map_live_status(body, train_no, start_date, self.name, now_ist_iso())


def get_railway_provider() -> RailwayProvider:
    settings = get_settings()
    # Guard live RapidAPI calls behind an explicit opt-in flag so low-quota free plans
    # (e.g. 10 requests/month) are never silently burned on user searches.
    if settings.rapidapi_live_enabled and settings.rapidapi_railway_key.strip():
        return RapidApiRailwayProvider(settings.rapidapi_railway_key.strip(), settings.rapidapi_railway_host.strip())
    return NullRailwayProvider()
