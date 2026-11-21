"""Local, offline-capable train reference data (stations, railheads, fallback timetable).

Autocomplete and railhead resolution use ONLY this module, so they never make an API call.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from services.common.config import REPO_ROOT

DEFAULT_DIR = REPO_ROOT / "data" / "trains"


def _dirs() -> List[Path]:
    override = os.environ.get("NE_TRAIN_DATA_DIR", "").strip()
    return ([Path(override)] if override else []) + [DEFAULT_DIR]


@lru_cache(maxsize=32)
def _read(directory: str, name: str) -> Optional[Dict[str, Any]]:
    path = Path(directory) / name
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _load(name: str) -> Dict[str, Any]:
    for d in _dirs():
        data = _read(str(d), name)
        if data is not None:
            return data
    return {}


def stations() -> List[Dict[str, Any]]:
    return list(_load("stations-nfr.json").get("stations", []))


def destinations() -> List[Dict[str, Any]]:
    return list(_load("ne-railheads.json").get("destinations", []))


def fallback() -> Dict[str, Any]:
    data = _load("fallback-nfr-trains.json")
    return {"verifiedAt": data.get("verifiedAt"), "source": data.get("source"), "trains": data.get("trains", [])}


def station_by_code(code: str) -> Optional[Dict[str, Any]]:
    code = code.strip().upper()
    return next((s for s in stations() if s["code"] == code), None)


def destination_by_id(dest_id: str) -> Optional[Dict[str, Any]]:
    return next((d for d in destinations() if d["id"] == dest_id), None)


def _expand_destination(d: Dict[str, Any]) -> Dict[str, Any]:
    heads = []
    for rh in d.get("railheads", []):
        st = station_by_code(rh["code"]) or {}
        heads.append({
            **rh,
            "name": st.get("name", rh["code"]),
            "roadKm": rh.get("roadKm"),
            "driveMinutes": rh.get("driveMinutes"),
            "road": rh.get("road") or {"status": "needs_verification", "lastVerifiedAt": None, "source": None},
        })
    return {
        "kind": "place",
        "id": d["id"],
        "name": d["name"],
        "stateCode": d.get("stateCode"),
        "lat": d.get("lat"),
        "lng": d.get("lng"),
        "permitAreaId": d.get("permitAreaId"),
        "hasDirectRail": bool(d.get("hasDirectRail")),
        "railheads": heads,
        "legs": d.get("legs", []),
        "rail": d.get("rail"),
    }


def search_local(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Station-code, station-name and place/landmark matching. Zero network calls."""
    q = query.strip().lower()
    if not q:
        return []
    scored: List[tuple] = []

    for st in stations():
        code, name = st["code"].lower(), st["name"].lower()
        if code == q:
            score = 0
        elif name.startswith(q) or code.startswith(q):
            score = 2
        elif q in name:
            score = 4
        else:
            continue
        scored.append((score, 1, {"kind": "station", "code": st["code"], "name": st["name"], "stateCode": st.get("stateCode")}))

    for d in destinations():
        names = [d["name"].lower()] + [a.lower() for a in d.get("aliases", [])]
        if any(n.startswith(q) for n in names):
            score = 1
        elif any(q in n for n in names):
            score = 3
        else:
            continue
        scored.append((score, 0, _expand_destination(d)))

    scored.sort(key=lambda x: (x[0], x[1], x[2].get("name", "")))
    return [item for _, _, item in scored[:limit]]
