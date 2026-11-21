"""One-time, budget-capped RapidAPI corridor timetable downloader.

Fetches real train schedules from RapidAPI (1 request per corridor) and merges them permanently
into data/trains/fallback-nfr-trains.json so the app can search trains with ZERO live API calls.

Usage:
  .venv/Scripts/python.exe data/trains/sync_rapidapi_corridors.py --max-requests 5 --corridors GHY:DBRG,GHY:DMV,GHY:AGTL,GHY:SANG,NJP:GHY
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.api.app.integrations.railway import ProviderError, RapidApiRailwayProvider
from services.common.config import get_settings
from services.common.train_data import station_by_code
from services.common.trains import today_ist

FALLBACK_PATH = Path(__file__).resolve().parent / "fallback-nfr-trains.json"
DEFAULT_CORRIDORS = ["GHY:DBRG", "GHY:DMV", "GHY:AGTL", "GHY:SANG", "NJP:GHY"]


def _hhmm_from_iso(iso: str) -> str:
    if "T" in iso:
        return iso.split("T", 1)[1][:5]
    return iso[:5]


async def sync_corridors(corridors: List[str], max_requests: int, dry_run: bool = False) -> int:
    settings = get_settings()
    key = settings.rapidapi_railway_key.strip()
    host = settings.rapidapi_railway_host.strip() or "irctc1.p.rapidapi.com"
    if not key and not dry_run:
        print("ERROR: Set RAPIDAPI_RAILWAY_KEY in .env before running this one-time sync.")
        return 1

    to_fetch = corridors[:max_requests]
    print(f"Planned RapidAPI requests: {len(to_fetch)} (cap --max-requests={max_requests})")
    if dry_run:
        for c in to_fetch:
            print(f"  [dry-run] would fetch corridor {c}")
        return 0

    existing_doc: Dict[str, Any] = json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
    by_train_no: Dict[str, Dict[str, Any]] = {t["trainNo"]: t for t in existing_doc.get("trains", [])}

    provider = RapidApiRailwayProvider(api_key=key, host=host)
    jdate = today_ist()
    requests_used = 0
    added_or_updated = 0

    for pair in to_fetch:
        if ":" not in pair:
            continue
        fc, tc = [p.strip().upper() for p in pair.split(":", 1)]
        requests_used += 1
        print(f"[{requests_used}/{len(to_fetch)}] Fetching {fc} -> {tc} on {jdate.isoformat()} ...")
        try:
            trains = await provider.search_trains(fc, tc, jdate)
        except ProviderError as exc:
            print(f"  FAILED ({exc}) — stopping to protect remaining quota.")
            break

        for tr in trains:
            from_st = station_by_code(tr.from_code) or {"name": tr.from_code}
            to_st = station_by_code(tr.to_code) or {"name": tr.to_code}
            # Preserve richer multi-stop entry if already curated; otherwise store corridor endpoints
            if tr.train_no not in by_train_no:
                by_train_no[tr.train_no] = {
                    "trainNo": tr.train_no,
                    "name": tr.name,
                    "type": tr.type,
                    "runsOn": tr.runs_on,
                    "classes": tr.classes,
                    "stops": [
                        {
                            "stationCode": tr.from_code,
                            "stationName": from_st["name"],
                            "distanceKm": 0,
                            "day": 1,
                            "schedArr": None,
                            "schedDep": _hhmm_from_iso(tr.departure),
                        },
                        {
                            "stationCode": tr.to_code,
                            "stationName": to_st["name"],
                            "distanceKm": None,
                            "day": 1 + tr.arrival_day_offset,
                            "schedArr": _hhmm_from_iso(tr.arrival),
                            "schedDep": None,
                        },
                    ],
                }
                added_or_updated += 1
        print(f"  Received {len(trains)} trains.")

    existing_doc["verifiedAt"] = date.today().isoformat()
    existing_doc["source"] = f"Saved timetable synced via {host} (not live; confirm on IRCTC / NTES)"
    existing_doc["trains"] = sorted(by_train_no.values(), key=lambda x: x["trainNo"])
    FALLBACK_PATH.write_text(json.dumps(existing_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Done. Requests used: {requests_used}. New trains added: {added_or_updated}. Total saved: {len(existing_doc['trains'])}.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Budget-capped one-time RapidAPI train timetable sync.")
    parser.add_argument("--max-requests", type=int, default=5, help="Hard cap on RapidAPI calls (default: 5)")
    parser.add_argument("--corridors", type=str, default=",".join(DEFAULT_CORRIDORS))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    corridors = [c.strip() for c in args.corridors.split(",") if c.strip()]
    return asyncio.run(sync_corridors(corridors, max_requests=max(1, args.max_requests), dry_run=args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
