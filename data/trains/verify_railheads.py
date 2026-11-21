"""Verify road distances & drive times for ne-railheads.json via Google Routes API."""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.api.app.integrations.google_maps import get_maps_client

DATA_DIR = Path(__file__).resolve().parent


async def verify_all() -> None:
    stations_doc = json.loads((DATA_DIR / "stations-nfr.json").read_text(encoding="utf-8"))
    stations = {s["code"]: s for s in stations_doc["stations"]}

    rh_path = DATA_DIR / "ne-railheads.json"
    rh_doc = json.loads(rh_path.read_text(encoding="utf-8"))
    maps = get_maps_client()
    today = date.today().isoformat()

    for dest in rh_doc["destinations"]:
        target = dest.get("roadDestination") or {"lat": dest["lat"], "lng": dest["lng"]}
        for rh in dest.get("railheads", []):
            st = stations.get(rh["code"])
            if not st:
                continue
            if dest.get("hasDirectRail") and rh.get("isPrimary") and dest["id"] != "aizawl":
                rh["roadKm"] = 0
                rh["driveMinutes"] = 0
                rh["road"] = {"status": "direct_rail", "lastVerifiedAt": today, "source": "Direct station in city"}
                continue
            route = await maps.compute_route(st["lat"], st["lng"], target["lat"], target["lng"], travel_mode="DRIVE")
            rh["roadKm"] = round(float(route["distance_km"]))
            rh["driveMinutes"] = int(route["duration_min"])
            src = "Google Routes API" if route.get("source") == "google_routes" else "Approximate hill-road model"
            rh["road"] = {"status": "verified" if route.get("source") == "google_routes" else "approximate", "lastVerifiedAt": today, "source": src}
            print(f"  {st['code']} -> {dest['name']}: ~{rh['roadKm']} km, ~{rh['driveMinutes']} min ({src})")

    rh_path.write_text(json.dumps(rh_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Updated ne-railheads.json")


if __name__ == "__main__":
    asyncio.run(verify_all())
