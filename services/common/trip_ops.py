from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from services.common.i18n import localize
from services.common.permit_engine import build_permit_checklist
from services.common.repository import BaseNoSQLRepo, utc_now_iso


def _default_packing_items(state_codes: List[str]) -> List[Dict[str, Any]]:
    high_alt = any(s in ("AR", "SK", "NL") for s in state_codes)
    items = [
        {"id": "pack_id", "category": "documents", "label": "Original Govt Photo ID / Passport & Visa", "checked": False},
        {"id": "pack_ilp", "category": "documents", "label": "Downloaded & printed ILP/PAP permit copies", "checked": False},
        {"id": "pack_cash", "category": "essentials", "label": "Emergency cash (ATMs can be sparse in hill towns)", "checked": False},
        {"id": "pack_powerbank", "category": "essentials", "label": "Power bank & offline state pack downloaded", "checked": False},
        {"id": "pack_rain", "category": "clothing", "label": "Lightweight waterproof jacket / poncho", "checked": False},
        {"id": "pack_shoes", "category": "clothing", "label": "Grip walking/trekking shoes", "checked": False},
        {"id": "pack_meds", "category": "health", "label": "Personal medicines, ORS & motion-sickness tablets", "checked": False},
    ]
    if high_alt:
        items.extend(
            [
                {"id": "pack_thermal", "category": "clothing", "label": "Thermal base layer, fleece & warm beanie", "checked": False},
                {"id": "pack_ams", "category": "health", "label": "Altitude guidance: hydrate well & ascend gradually", "checked": False},
            ]
        )
    return items


def create_trip_with_days(
    repo: BaseNoSQLRepo,
    owner_id: str,
    title: str,
    origin_text: str,
    state_codes: List[str],
    start_date: str,
    end_date: str,
    party_size: int = 1,
    budget_inr: int = 15000,
    status: str = "planned",
    created_via: str = "manual",
    citizen_type: str = "indian",
    nationality_code: str = "IN",
    date_of_birth: Optional[str] = None,
    lang: str = "en",
) -> Dict[str, Any]:
    trip_id = f"trip_{uuid.uuid4().hex[:10]}"
    clean_states = [s.upper() for s in state_codes if s]
    try:
        sd = date.fromisoformat(start_date[:10])
        ed = date.fromisoformat(end_date[:10])
        num_days = max(1, min(30, (ed - sd).days + 1))
    except ValueError:
        sd = date.today() + timedelta(days=7)
        num_days = 4
        start_date = sd.isoformat()
        end_date = (sd + timedelta(days=num_days - 1)).isoformat()

    trip_doc = {
        "id": trip_id,
        "owner_id": owner_id,
        "member_ids": [owner_id],
        "editor_ids": [owner_id],
        "members": [{"user_id": owner_id, "role": "owner"}],
        "title": title,
        "origin_text": origin_text,
        "state_codes": clean_states,
        "start_date": start_date,
        "end_date": end_date,
        "party_size": party_size,
        "budget_inr": budget_inr,
        "status": status,
        "created_via": created_via,
        "version": 1,
    }
    saved = repo.set_doc("trips", trip_id, trip_doc)

    for idx in range(1, num_days + 1):
        day_date = (sd + timedelta(days=idx - 1)).isoformat()
        repo.set_subdoc(
            "trips",
            trip_id,
            "days",
            f"day_{idx}",
            {"trip_id": trip_id, "day_index": idx, "date": day_date, "notes": ""},
        )

    for p_item in _default_packing_items(clean_states):
        repo.set_subdoc("trips", trip_id, "packing", p_item["id"], p_item)

    # Seed permit tasks automatically for each selected state
    seen_permits = set()
    for sc in clean_states:
        checklist = build_permit_checklist(
            repo=repo,
            citizen_type=citizen_type,
            nationality_code=nationality_code,
            date_of_birth=date_of_birth,
            state_code=sc,
            start_date=start_date,
            lang=lang,
        )
        for item in checklist["items"]:
            pid = item["permit_id"]
            if pid in seen_permits or not item.get("required"):
                continue
            seen_permits.add(pid)
            task_id = f"pt_{pid}"
            repo.set_subdoc(
                "trips",
                trip_id,
                "permit_tasks",
                task_id,
                {
                    "id": task_id,
                    "trip_id": trip_id,
                    "permit_id": pid,
                    "permit_name": item["name"],
                    "state_code": sc,
                    "portal_url": item["portal_url"],
                    "last_verified_at": item["last_verified_at"],
                    "needs_check": item["needs_check"],
                    "traveler_user_id": owner_id,
                    "status": "not_started",
                    "reference_no": "",
                },
            )
    return saved


def add_item_to_trip(
    repo: BaseNoSQLRepo,
    trip_id: str,
    day_index: int,
    item_type: str,
    title: str,
    position: Optional[int] = None,
    google_place_id: Optional[str] = None,
    ref_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    payload: Optional[Dict[str, Any]] = None,
    status: str = "planned",
) -> Dict[str, Any]:
    existing_items = repo.list_subdocs("trips", trip_id, "items")
    day_items = [it for it in existing_items if it.get("day_index") == day_index]
    pos = position if position is not None else len(day_items)

    item_id = f"item_{uuid.uuid4().hex[:10]}"
    item_doc = {
        "id": item_id,
        "trip_id": trip_id,
        "day_index": day_index,
        "position": pos,
        "type": item_type,
        "google_place_id": google_place_id,
        "ref_id": ref_id,
        "title": title,
        "start_time": start_time,
        "end_time": end_time,
        "lat": lat,
        "lng": lng,
        "payload": payload or {},
        "status": status,
    }
    saved = repo.set_subdoc("trips", trip_id, "items", item_id, item_doc)
    trip = repo.get_doc("trips", trip_id)
    if trip:
        repo.update_doc("trips", trip_id, {"version": int(trip.get("version", 1)) + 1})
    return saved


def estimate_trip_budget(repo: BaseNoSQLRepo, trip_id: str) -> Dict[str, Any]:
    trip = repo.get_doc("trips", trip_id)
    if not trip:
        return {"error": "Trip not found"}
    days = repo.list_subdocs("trips", trip_id, "days")
    items = repo.list_subdocs("trips", trip_id, "items")
    expenses = repo.list_subdocs("trips", trip_id, "expenses")
    party = max(1, int(trip.get("party_size", 1)))
    num_days = max(1, len(days))

    transport_est = 0
    activity_est = 0
    for it in items:
        payload = it.get("payload") or {}
        cost = int(payload.get("estimated_cost_inr", 0) or 0)
        if it.get("type") in ("travel_leg", "train"):
            transport_est += cost or 600
        elif it.get("type") == "place":
            activity_est += cost or 250

    stay_est = max(0, (num_days - 1)) * 1800 * max(1, (party + 1) // 2)
    meals_est = num_days * 650 * party
    total_est = transport_est + activity_est + stay_est + meals_est
    logged_spent = sum(float(e.get("amount_inr", 0)) for e in expenses)

    return {
        "trip_id": trip_id,
        "party_size": party,
        "days": num_days,
        "target_budget_inr": trip.get("budget_inr", 0),
        "estimated_breakdown_inr": {
            "transport": transport_est,
            "stays": stay_est,
            "meals": meals_est,
            "activities_and_entries": activity_est,
        },
        "estimated_total_inr": total_est,
        "per_person_estimated_inr": round(total_est / party),
        "logged_expenses_inr": round(logged_spent, 2),
        "note": "Permit fees vary by official portal; verify permit fees separately.",
    }


def generate_structured_trip(
    repo: BaseNoSQLRepo,
    owner_id: str,
    destination_state: str,
    days: int = 4,
    start_date: Optional[str] = None,
    origin: str = "Guwahati",
    interests: Optional[List[str]] = None,
    budget_inr: int = 25000,
    party_size: int = 2,
    citizen_type: str = "indian",
    nationality_code: str = "IN",
    date_of_birth: Optional[str] = None,
    lang: str = "en",
    created_via: str = "manual",
) -> Dict[str, Any]:
    sc = destination_state.upper().strip()
    state_doc = repo.get_doc("states", sc)
    state_name = localize((state_doc or {}).get("name_i18n"), lang) or sc

    sd = date.today() + timedelta(days=14)
    if start_date:
        try:
            sd = date.fromisoformat(start_date[:10])
        except ValueError:
            pass
    ed = sd + timedelta(days=max(1, days) - 1)

    trip = create_trip_with_days(
        repo=repo,
        owner_id=owner_id,
        title=f"{days}-Day {state_name} Discovery",
        origin_text=origin,
        state_codes=[sc],
        start_date=sd.isoformat(),
        end_date=ed.isoformat(),
        party_size=party_size,
        budget_inr=budget_inr,
        status="draft",
        created_via=created_via,
        citizen_type=citizen_type,
        nationality_code=nationality_code,
        date_of_birth=date_of_birth,
        lang=lang,
    )
    trip_id = trip["id"]

    # Add permit check item on Day 1 if permits are required
    permit_tasks = repo.list_subdocs("trips", trip_id, "permit_tasks")
    if permit_tasks:
        names = ", ".join(pt["permit_name"] for pt in permit_tasks)
        add_item_to_trip(
            repo,
            trip_id=trip_id,
            day_index=1,
            item_type="permit_task",
            title=f"Verify & carry required permits: {names}",
            start_time="08:00",
            payload={"permit_ids": [pt["permit_id"] for pt in permit_tasks], "portal_url": permit_tasks[0].get("portal_url")},
        )

    # Add inbound travel leg
    add_item_to_trip(
        repo,
        trip_id=trip_id,
        day_index=1,
        item_type="travel_leg",
        title=f"Travel from {origin} to {state_name} base",
        start_time="09:00",
        payload={"mode": "shared_sumo", "estimated_cost_inr": 650 * party_size},
    )

    # Pick curated places in state matching interests if possible
    state_places = repo.query_docs("places", filters=[("state_code", "==", sc)])
    interest_set = {i.lower() for i in (interests or [])}
    state_places.sort(
        key=lambda p: (
            -sum(1 for c in (p.get("categories") or []) if c in interest_set),
            not bool(p.get("is_featured")),
        )
    )
    for idx, pl in enumerate(state_places[: max(2, days)]):
        day_idx = min(days, (idx // 1) + 1)
        add_item_to_trip(
            repo,
            trip_id=trip_id,
            day_index=day_idx,
            item_type="place",
            google_place_id=pl.get("google_place_id"),
            ref_id=pl["id"],
            title=localize(pl.get("name_i18n"), lang),
            start_time="10:30" if idx % 2 == 0 else "14:00",
            lat=pl.get("lat"),
            lng=pl.get("lng"),
            payload={"notes": localize(pl.get("curated_notes_i18n"), lang), "estimated_cost_inr": 300 * party_size},
        )

    # Add a local culinary highlight
    specs = repo.query_docs("specialities", filters=[("state_code", "==", sc)])
    dishes = [s for s in specs if s.get("type") == "dish"]
    if dishes:
        d0 = dishes[0]
        add_item_to_trip(
            repo,
            trip_id=trip_id,
            day_index=min(2, days),
            item_type="meal",
            ref_id=d0["id"],
            title=f"Try local speciality: {localize(d0.get('name_i18n'), lang)}",
            start_time="19:00",
            payload={"where": localize(d0.get("where_to_find_i18n"), lang)},
        )

    return get_full_trip(repo, trip_id) or trip


def get_full_trip(repo: BaseNoSQLRepo, trip_id: str) -> Optional[Dict[str, Any]]:
    trip = repo.get_doc("trips", trip_id)
    if not trip:
        return None
    days = repo.list_subdocs("trips", trip_id, "days", order_by="day_index")
    items = repo.list_subdocs("trips", trip_id, "items", order_by="position")
    items.sort(key=lambda x: (x.get("day_index", 1), x.get("position", 0)))
    permit_tasks = repo.list_subdocs("trips", trip_id, "permit_tasks")
    expenses = repo.list_subdocs("trips", trip_id, "expenses", order_by="spent_at", descending=True)
    packing = repo.list_subdocs("trips", trip_id, "packing")
    budget = estimate_trip_budget(repo, trip_id)
    return {
        **trip,
        "days": days,
        "items": items,
        "permit_tasks": permit_tasks,
        "expenses": expenses,
        "packing": packing,
        "budget_summary": budget,
        "last_synced_at": utc_now_iso(),
    }
