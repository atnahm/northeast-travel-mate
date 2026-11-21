"""Domain types and helpers for the Trains feature.

JSON is camelCase on the wire (matching the TypeScript types) and snake_case in Python.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

IST = timezone(timedelta(hours=5, minutes=30))
WEEKDAY_CODES = ["M", "T", "W", "Th", "F", "Sa", "Su"]  # Monday == 0
DataSource = Literal["live", "cached", "scheduled_fallback"]
LiveState = Literal["not_started", "running", "terminated", "cancelled", "diverted", "unavailable"]

DISCLAIMER = (
    "Live data comes from {provider} and may differ from station displays. "
    "Confirm with Indian Railways before you travel."
)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    def wire(self) -> dict:
        return self.model_dump(by_alias=True, mode="json")


class TrainSummary(CamelModel):
    train_no: str
    name: str
    type: str
    from_code: str
    to_code: str
    departure: str  # ISO 8601 with +05:30
    arrival: str
    duration_min: int
    arrival_day_offset: int
    runs_on: List[str]
    runs_on_selected_date: Optional[bool] = None
    classes: List[str] = []
    source: DataSource
    fetched_at: Optional[str] = None
    provider: str


class TrainStop(CamelModel):
    station_code: str
    station_name: str
    distance_km: Optional[float] = None
    sched_arr: Optional[str] = None
    sched_dep: Optional[str] = None
    exp_arr: Optional[str] = None
    exp_dep: Optional[str] = None
    delay_min: Optional[int] = None
    halt_min: Optional[int] = None
    platform: Optional[str] = None
    passed: bool = False


class TrainRoute(CamelModel):
    train_no: str
    name: str
    type: str
    stops: List[TrainStop]
    source: DataSource
    fetched_at: Optional[str] = None
    provider: str


class LiveStatus(CamelModel):
    train_no: str
    start_date: str
    state: LiveState
    current_station_code: Optional[str] = None
    next_station_code: Optional[str] = None
    delay_min: Optional[int] = None
    stops: List[TrainStop] = []
    fetched_at: Optional[str] = None
    provider: str
    source: DataSource
    message: Optional[str] = None


def today_ist() -> date:
    return datetime.now(IST).date()


def now_ist_iso() -> str:
    return datetime.now(IST).isoformat(timespec="seconds")


def parse_hhmm(value: Optional[str]) -> Optional[time]:
    """Parse 'HH:MM' (or 'HH:MM:SS'). Returns None for blanks and placeholders such as '--'."""
    if not value:
        return None
    text = str(value).strip()
    if text in {"--", "-", "--:--", "Source", "Destination"}:
        return None
    try:
        parts = text.split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def iso_ist(day: date, hhmm: Optional[str], day_offset: int = 0) -> Optional[str]:
    """Combine a calendar day, 'HH:MM' and a day offset into an ISO string with +05:30."""
    t = parse_hhmm(hhmm)
    if t is None:
        return None
    return datetime.combine(day + timedelta(days=day_offset), t, tzinfo=IST).isoformat(timespec="minutes")


def parse_duration_min(value: Optional[str]) -> Optional[int]:
    """Parse 'HH:MM' durations such as '07:35' into minutes."""
    t = parse_hhmm(value)
    return None if t is None else t.hour * 60 + t.minute


def weekday_code(day: date) -> str:
    return WEEKDAY_CODES[day.weekday()]


def runs_on_date(runs_on: List[str], day: date) -> Optional[bool]:
    """True/False when the running days are known, None when the provider gave none."""
    if not runs_on:
        return None
    return weekday_code(day) in runs_on


def arrival_offset(dep_hhmm: Optional[str], duration_min: Optional[int]) -> Optional[int]:
    """Days after departure that the train arrives (0 = same day). Derived, never trusted from the provider."""
    t = parse_hhmm(dep_hhmm)
    if t is None or duration_min is None:
        return None
    return (t.hour * 60 + t.minute + duration_min) // 1440


DAY_NAME_TO_CODE = {
    "mon": "M", "tue": "T", "wed": "W", "thu": "Th", "fri": "F", "sat": "Sa", "sun": "Su",
    "m": "M", "t": "T", "w": "W", "th": "Th", "f": "F", "sa": "Sa", "su": "Su",
}


def normalise_runs_on(raw: List[str]) -> List[str]:
    out: List[str] = []
    for item in raw or []:
        code = DAY_NAME_TO_CODE.get(str(item).strip().lower()[:3]) or DAY_NAME_TO_CODE.get(str(item).strip().lower())
        if code and code not in out:
            out.append(code)
    return out
