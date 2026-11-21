"""
Seed all 8 North-East states' curated collections into Cloud Firestore (or local NoSQL store).

Usage:
  .venv/Scripts/python.exe data/seed/seed_firestore.py --target auto
  .venv/Scripts/python.exe data/seed/seed_firestore.py --target firestore
  .venv/Scripts/python.exe data/seed/seed_firestore.py --target local
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.common.firebase_client import get_resolved_mode, init_firebase, reset_firebase_state_for_tests
from services.common.geo import encode_geohash
from services.common.i18n import SUPPORTED_LANGS, localize
from services.common.repository import BaseNoSQLRepo, get_repo, reset_repo_for_tests

SEED_DIR = Path(__file__).resolve().parent


def _load_json(filename: str) -> Any:
    path = SEED_DIR / filename
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _build_kb_chunks(
    permits: List[Dict[str, Any]],
    places: List[Dict[str, Any]],
    specialities: List[Dict[str, Any]],
    festivals: List[Dict[str, Any]],
) -> List[Tuple[str, Dict[str, Any]]]:
    chunks: List[Tuple[str, Dict[str, Any]]] = []
    for p in permits:
        for lang in SUPPORTED_LANGS:
            text = (
                f"Permit {p['code']} ({p['state_code']}): {localize(p.get('name_i18n'), lang)}. "
                f"{localize(p.get('description_i18n'), lang)} "
                f"Authority: {p.get('issuing_authority')}. Portal: {p.get('portal_url')}. "
                f"Last verified: {p.get('last_verified_at')}."
            )
            chunks.append(
                (
                    f"kb_permit_{p['id']}_{lang}",
                    {
                        "source_type": "permit",
                        "source_id": p["id"],
                        "state_code": p.get("state_code"),
                        "lang": lang,
                        "text": text,
                        "last_verified_at": p.get("last_verified_at"),
                    },
                )
            )
    for pl in places:
        for lang in SUPPORTED_LANGS:
            text = (
                f"{localize(pl.get('name_i18n'), lang)} ({pl['state_code']}, categories: {', '.join(pl.get('categories', []))}). "
                f"{localize(pl.get('curated_notes_i18n'), lang)} How to reach: {pl.get('how_to_reach', '')}"
            )
            chunks.append(
                (
                    f"kb_place_{pl['id']}_{lang}",
                    {
                        "source_type": "place",
                        "source_id": pl["id"],
                        "state_code": pl.get("state_code"),
                        "lang": lang,
                        "text": text,
                    },
                )
            )
    for sp in specialities:
        for lang in ("en", "hi"):
            text = (
                f"{localize(sp.get('name_i18n'), lang)} ({sp['state_code']} {sp['type']}): "
                f"{localize(sp.get('description_i18n'), lang)} Where: {localize(sp.get('where_to_find_i18n'), lang)}"
            )
            chunks.append(
                (
                    f"kb_spec_{sp['id']}_{lang}",
                    {
                        "source_type": "speciality",
                        "source_id": sp["id"],
                        "state_code": sp.get("state_code"),
                        "lang": lang,
                        "text": text,
                    },
                )
            )
    for f in festivals:
        text = (
            f"Festival {localize(f.get('name_i18n'), 'en')} ({f['state_code']}): "
            f"{f.get('start_date')} to {f.get('end_date')}. {localize(f.get('description_i18n'), 'en')}"
        )
        chunks.append(
            (
                f"kb_fest_{f['id']}_en",
                {
                    "source_type": "festival",
                    "source_id": f["id"],
                    "state_code": f.get("state_code"),
                    "lang": "en",
                    "text": text,
                    "last_verified_at": f.get("last_verified_at"),
                },
            )
        )
    return chunks


def seed_all(repo: BaseNoSQLRepo, dry_run: bool = False) -> Dict[str, int]:
    states = _load_json("states.json")
    permit_areas = _load_json("permit_areas.json")
    permits = _load_json("permits.json")
    permit_rules = _load_json("permit_rules.json")
    places = _load_json("places.json")
    specialities = _load_json("specialities.json")
    transport = _load_json("transport.json")
    misc = _load_json("alerts_festivals_phrasebook_helplines.json")

    for pl in places:
        pl["geohash"] = encode_geohash(pl["lat"], pl["lng"], precision=6)

    kb_chunks = _build_kb_chunks(permits, places, specialities, misc["festivals"])

    collections: Dict[str, List[Tuple[str, Dict[str, Any]]]] = {
        "states": [(d["id"], d) for d in states],
        "permit_areas": [(d["id"], d) for d in permit_areas],
        "permits": [(d["id"], d) for d in permits],
        "permit_rules": [(d["id"], d) for d in permit_rules],
        "places": [(d["id"], d) for d in places],
        "specialities": [(d["id"], d) for d in specialities],
        "transport_nodes": [(d["id"], d) for d in transport["nodes"]],
        "transport_options": [(d["id"], d) for d in transport["options"]],
        "alerts": [(d["id"], d) for d in misc["alerts"]],
        "festivals": [(d["id"], d) for d in misc["festivals"]],
        "phrasebook": [(d["id"], d) for d in misc["phrasebook"]],
        "helplines": [(d["id"], d) for d in misc["helplines"]],
        "kb_chunks": kb_chunks,
    }

    counts: Dict[str, int] = {}
    for col_name, items in collections.items():
        if dry_run:
            counts[col_name] = len(items)
        else:
            counts[col_name] = repo.batch_set(col_name, items)
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed NE Mate curated data to Firestore or local NoSQL store.")
    parser.add_argument("--target", choices=["auto", "firestore", "emulator", "local"], default="auto")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    reset_firebase_state_for_tests()
    reset_repo_for_tests()
    init_firebase(force_mode=None if args.target == "auto" else args.target)
    mode = get_resolved_mode()
    repo = get_repo(force_local=(args.target == "local"))

    counts = seed_all(repo, dry_run=args.dry_run)
    print(f"Seed complete (mode={mode}, dry_run={args.dry_run}):")
    for k, v in counts.items():
        print(f"  - {k}: {v} documents")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
