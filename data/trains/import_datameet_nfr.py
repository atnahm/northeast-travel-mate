"""One-time importer for the public open-source DataMeet Indian Railways dataset.

Downloads stations.json, trains.json, and schedules.json from:
  https://github.com/datameet/railways (CC-BY-SA / open data)

Filters to all trains serving North-East India / Northeast Frontier Railway (NFR)
stations (>= 2 NFR stops), preserves curated 2025/2026 NFR trains (such as
Sairang SANG and Vande Bharat 22227/22228), and writes:
  - data/trains/stations-nfr.json
  - data/trains/fallback-nfr-trains.json

Zero RapidAPI requests are used.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

REPO_ROOT = Path(__file__).resolve().parents[2]
TRAINS_DIR = REPO_ROOT / "data" / "trains"
STATIONS_PATH = TRAINS_DIR / "stations-nfr.json"
FALLBACK_PATH = TRAINS_DIR / "fallback-nfr-trains.json"

BASE_URL = "https://raw.githubusercontent.com/datameet/railways/master"

STATE_TO_CODE = {
    "assam": "AS",
    "arunachal pradesh": "AR",
    "nagaland": "NL",
    "manipur": "MN",
    "mizoram": "MZ",
    "tripura": "TR",
    "meghalaya": "ML",
    "sikkim": "SK",
    "west bengal": "WB",
    "bihar": "BR",
}

NE_STATES = {"AS", "AR", "NL", "MN", "MZ", "TR", "ML", "SK"}


def _clean_time(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("none", "null", "source", "destination", "--", "00:00:00"):
        return None
    parts = s.split(":")
    if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
        hh, mm = int(parts[0]), int(parts[1])
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"
    return None


def _normalise_type(raw_type: Any, name: str) -> str:
    n = name.lower()
    t = str(raw_type or "").strip().lower()
    if "vande bharat" in n:
        return "Vande Bharat"
    if "rajdhani" in n or t == "raj":
        return "Rajdhani"
    if "shatabdi" in n or t in ("shtb", "jshtb"):
        return "Shatabdi"
    if "duronto" in n or t == "drnt":
        return "Duronto"
    if "superfast" in n or "sf" in n.split() or t in ("sf", "superfast"):
        return "Superfast"
    if "passenger" in n or "demu" in n or "memu" in n or t in ("pass", "demu", "memu"):
        return "Passenger"
    if "mail" in n or "express" in n or "exp" in n or t in ("exp", "mail"):
        return "Express"
    return "Express"


def _extract_classes(props: Dict[str, Any]) -> List[str]:
    classes: List[str] = []
    mapping = [
        ("first_ac", "1A"),
        ("second_ac", "2A"),
        ("third_ac", "3A"),
        ("chair_car", "CC"),
        ("sleeper", "SL"),
        ("first_class", "FC"),
    ]
    for key, code in mapping:
        val = props.get(key)
        if val in (1, True, "1", "true", "True"):
            classes.append(code)
    return classes or ["SL", "3A"]


def _fetch_json(client: httpx.Client, filename: str) -> Any:
    url = f"{BASE_URL}/{filename}"
    print(f"Downloading {url} ...")
    resp = client.get(url)
    resp.raise_for_status()
    return resp.json()


def main() -> int:
    # Load existing curated files first so we preserve newer 2025/2026 entries
    existing_stations_doc = json.loads(STATIONS_PATH.read_text(encoding="utf-8"))
    existing_stations: List[Dict[str, Any]] = existing_stations_doc.get("stations", [])
    curated_station_map: Dict[str, Dict[str, Any]] = {s["code"].upper(): s for s in existing_stations}

    existing_fallback_doc = json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
    existing_trains: List[Dict[str, Any]] = existing_fallback_doc.get("trains", [])
    curated_train_map: Dict[str, Dict[str, Any]] = {str(t["trainNo"]): t for t in existing_trains}

    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        stations_geo = _fetch_json(client, "stations.json")
        trains_geo = _fetch_json(client, "trains.json")
        schedules_raw = _fetch_json(client, "schedules.json")

    # 1. Build NFR / NE station set from DataMeet stations.json
    nfr_codes = set(curated_station_map.keys())
    dm_stations_by_code: Dict[str, Dict[str, Any]] = {}

    for feat in stations_geo.get("features", []):
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        code = str(props.get("code") or "").strip().upper()
        name = str(props.get("name") or "").strip()
        zone = str(props.get("zone") or "").strip().upper()
        state_raw = str(props.get("state") or "").strip().lower()
        state_code = STATE_TO_CODE.get(state_raw, "")
        if not code or not name:
            continue

        is_nfr_or_ne = (zone == "NFR") or (state_code in NE_STATES) or (code in curated_station_map)
        if is_nfr_or_ne:
            nfr_codes.add(code)
            if len(coords) >= 2 and coords[0] is not None and coords[1] is not None:
                lng, lat = float(coords[0]), float(coords[1])
                dm_stations_by_code[code] = {
                    "code": code,
                    "name": name,
                    "stateCode": state_code or "AS",
                    "lat": round(lat, 4),
                    "lng": round(lng, 4),
                }

    # Merge stations: curated first (preserves exact names/coords for SANG, NHLN, etc.), then DataMeet NFR stations
    merged_stations: List[Dict[str, Any]] = list(existing_stations)
    seen_codes = {s["code"].upper() for s in merged_stations}
    for code in sorted(dm_stations_by_code.keys()):
        if code not in seen_codes:
            st = dm_stations_by_code[code]
            # Keep only stations in NE states + WB/BR NFR gateways with valid India coordinates
            if 21.0 <= st["lat"] <= 29.5 and 86.5 <= st["lng"] <= 97.5:
                merged_stations.append(st)
                seen_codes.add(code)

    # 2. Index train metadata from trains.json
    train_meta: Dict[str, Dict[str, Any]] = {}
    for feat in trains_geo.get("features", []):
        props = feat.get("properties") or {}
        num = str(props.get("number") or "").strip()
        if num:
            train_meta[num] = props

    # 3. Group schedule rows by train_number
    stops_by_train: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in schedules_raw:
        num = str(row.get("train_number") or "").strip()
        if num:
            stops_by_train[num].append(row)

    # 4. Convert all trains with >= 2 NFR/NE stops into our schema
    imported_trains: Dict[str, Dict[str, Any]] = {}
    for num, rows in stops_by_train.items():
        if not (num.isdigit() and len(num) == 5):
            continue
        if num in curated_train_map:
            # Keep our newer 2025/2026 curated schedule
            continue

        # Sort by stop id/day/arrival order (schedules.json preserves sequence order per train; keep original order)
        nfr_hit_count = sum(1 for r in rows if str(r.get("station_code") or "").strip().upper() in nfr_codes)
        if nfr_hit_count < 2:
            continue

        meta = train_meta.get(num, {})
        name = str(meta.get("name") or rows[0].get("train_name") or f"Train {num}").strip()
        tr_type = _normalise_type(meta.get("type"), name)
        classes = _extract_classes(meta)

        stops: List[Dict[str, Any]] = []
        last_day = 1
        last_hhmm = -1
        for idx, r in enumerate(rows):
            code = str(r.get("station_code") or "").strip().upper()
            st_name = str(r.get("station_name") or code).strip()
            if not code:
                continue
            arr = _clean_time(r.get("arrival"))
            dep = _clean_time(r.get("departure"))
            if idx == 0:
                arr = None
            if idx == len(rows) - 1:
                dep = None
            if arr is None and dep is None:
                continue

            day_raw = r.get("day")
            if day_raw not in (None, "", "None") and str(day_raw).isdigit():
                day = max(1, int(day_raw))
            else:
                # Infer day rollover if missing
                ref_t = arr or dep or "00:00"
                h, m = int(ref_t[:2]), int(ref_t[3:5])
                cur_min = h * 60 + m
                if last_hhmm >= 0 and cur_min < last_hhmm - 60:
                    last_day += 1
                day = last_day

            ref_t = dep or arr
            if ref_t:
                last_hhmm = int(ref_t[:2]) * 60 + int(ref_t[3:5])
                last_day = day

            # DataMeet schedules.json doesn't always include per-stop distance; leave null if absent
            dist_raw = r.get("distance")
            dist_km: Optional[float] = None
            if dist_raw not in (None, "", "None"):
                try:
                    dist_km = float(dist_raw)
                except ValueError:
                    dist_km = None

            stops.append({
                "stationCode": code,
                "stationName": st_name,
                "distanceKm": dist_km,
                "day": day,
                "schedArr": arr,
                "schedDep": dep,
            })

        if len(stops) < 2:
            continue

        imported_trains[num] = {
            "trainNo": num,
            "name": name,
            "type": tr_type,
            "runsOn": [],  # Unknown in DataMeet snapshot -> UI honestly shows runsOnSelectedDate = null (check IRCTC)
            "classes": classes,
            "stops": stops,
        }

    # Combine: curated 2025/2026 trains first, then imported DataMeet NFR trains sorted by trainNo
    all_trains = list(existing_trains) + [imported_trains[k] for k in sorted(imported_trains.keys())]

    stations_out = {
        "_meta": {
            "purpose": "NFR & North-East India station codes, names, and coordinates for zero-API local autocomplete.",
            "coordsSource": "Curated NE railheads + DataMeet Indian Railways open dataset (github.com/datameet/railways).",
            "updatedOn": date.today().isoformat(),
            "stationCount": len(merged_stations),
        },
        "stations": merged_stations,
    }
    STATIONS_PATH.write_text(json.dumps(stations_out, indent=2, ensure_ascii=False), encoding="utf-8")

    fallback_out = {
        "_meta": {
            "purpose": "Local NFR scheduled timetable (DataMeet open Indian Railways dataset + curated 2026 NFR updates). Always displayed as 'Scheduled timetable, not live'. Zero live status, delay, or platform data.",
            "stopFields": ["stationCode", "stationName", "distanceKm", "day", "schedArr", "schedDep"],
            "curatedCount": len(existing_trains),
            "datameetImportedCount": len(imported_trains),
            "totalTrains": len(all_trains),
        },
        "verifiedAt": date.today().isoformat(),
        "source": "Open-source Indian Railways timetable (DataMeet Railways) + curated NFR updates (not live; confirm on IRCTC / NTES)",
        "trains": all_trains,
    }
    FALLBACK_PATH.write_text(json.dumps(fallback_out, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"SUCCESS: Wrote {len(merged_stations)} NFR/NE stations to {STATIONS_PATH.name} "
        f"and {len(all_trains)} trains ({len(existing_trains)} curated + {len(imported_trains)} DataMeet NFR) "
        f"to {FALLBACK_PATH.name}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
