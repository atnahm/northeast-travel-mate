from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from services.api.app.services.train_service import (
    get_live_status_service,
    search_trains_service,
    validate_journey_date,
)
from services.common.geo import haversine_km
from services.common.i18n import localize, localize_doc
from services.common.permit_engine import build_permit_checklist
from services.common.repository import BaseNoSQLRepo
from services.common.trip_ops import (
    add_item_to_trip,
    create_trip_with_days,
    estimate_trip_budget,
    get_full_trip,
)

TOOL_DECLARATIONS: List[Dict[str, Any]] = [
    {
        "name": "get_user_profile",
        "description": "Get the signed-in traveler's preferred language, nationality, citizen type, and date of birth.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "search_places",
        "description": "Search curated places in North-East India by query, state_code (AS, ML, AR, NL, MN, MZ, SK, TR), and category.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "state": {"type": "string"},
                "category": {"type": "string"},
            },
            "required": [],
        },
    },
    {
        "name": "get_specialities",
        "description": "Get curated local dishes, crafts, and regional products for a North-East state.",
        "parameters": {
            "type": "object",
            "properties": {
                "state": {"type": "string"},
                "type": {"type": "string"},
            },
            "required": [],
        },
    },
    {
        "name": "get_travel_options",
        "description": "Get transport options (shared Sumo, bus, train, flight, ferry, self-drive) between two places/nodes.",
        "parameters": {
            "type": "object",
            "properties": {
                "from_name": {"type": "string"},
                "to_name": {"type": "string"},
                "date": {"type": "string"},
            },
            "required": ["from_name", "to_name"],
        },
    },
    {
        "name": "get_permits",
        "description": "Get authoritative, personalized permit checklist and official portal links for a state or destination.",
        "parameters": {
            "type": "object",
            "properties": {
                "destination": {"type": "string", "description": "State code (e.g. AR, NL, SK, ML) or place/area ID"},
                "start": {"type": "string"},
                "end": {"type": "string"},
            },
            "required": ["destination"],
        },
    },
    {
        "name": "get_alerts",
        "description": "Get active road, landslide, weather, or curfew alerts for a state.",
        "parameters": {
            "type": "object",
            "properties": {"area": {"type": "string", "description": "2-letter state code e.g. SK, AR, MN"}},
            "required": [],
        },
    },
    {
        "name": "search_trains",
        "description": "Search trains between two North-East railway station codes (e.g. GHY, DBRG, DMV, FKG, SANG, AGTL) on a date (YYYY-MM-DD).",
        "parameters": {
            "type": "object",
            "properties": {
                "from_code": {"type": "string"},
                "to_code": {"type": "string"},
                "date": {"type": "string"},
            },
            "required": ["from_code", "to_code"],
        },
    },
    {
        "name": "get_train_status",
        "description": "Get live train running status for a 5-digit North-East train number and start date (YYYY-MM-DD, today or yesterday).",
        "parameters": {
            "type": "object",
            "properties": {
                "train_no": {"type": "string"},
                "start_date": {"type": "string"},
            },
            "required": ["train_no"],
        },
    },
    {
        "name": "create_trip",
        "description": "Create a new draft trip in the user's Trip Planner.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "start": {"type": "string"},
                "end": {"type": "string"},
                "origin": {"type": "string"},
                "state_codes": {"type": "array", "items": {"type": "string"}},
                "budget_inr": {"type": "integer"},
                "party_size": {"type": "integer"},
            },
            "required": ["title", "start", "end", "origin"],
        },
    },
    {
        "name": "add_trip_item",
        "description": "Add a stop, travel leg, meal, or permit task to a specific day of an existing trip.",
        "parameters": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "string"},
                "day": {"type": "integer"},
                "type": {"type": "string"},
                "title": {"type": "string"},
                "ref_id": {"type": "string"},
                "start_time": {"type": "string"},
            },
            "required": ["trip_id", "day", "title"],
        },
    },
    {
        "name": "estimate_budget",
        "description": "Calculate estimated cost breakdown for a trip.",
        "parameters": {
            "type": "object",
            "properties": {"trip_id": {"type": "string"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "search_knowledge",
        "description": "Search the curated North-East India knowledge chunks (permits, places, specialities, festivals).",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "lang": {"type": "string"}},
            "required": ["query"],
        },
    },
]


async def _tool_user_profile(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    return {
        "result": {
            "uid": uid,
            "full_name": profile.get("full_name", "Traveler"),
            "preferred_lang": lang,
            "nationality_code": profile.get("nationality_code", "IN"),
            "citizen_type": profile.get("citizen_type", "indian"),
            "date_of_birth": profile.get("date_of_birth"),
        },
        "cards": [],
        "citations": [],
    }


async def _tool_search_places(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    sc = (args.get("state") or "").upper().strip()
    q = (args.get("query") or "").lower().strip()
    cat = (args.get("category") or "").lower().strip()
    places = repo.query_docs("places", filters=[("state_code", "==", sc)] if sc else None)
    matched = []
    for pl in places:
        if cat and cat not in (pl.get("categories") or []):
            continue
        name_en = localize(pl.get("name_i18n"), "en").lower()
        notes_en = localize(pl.get("curated_notes_i18n"), "en").lower()
        if q and q not in name_en and q not in notes_en and q not in pl.get("state_code", "").lower():
            continue
        loc = localize_doc(pl, lang)
        matched.append(
            {
                "id": loc["id"],
                "name": loc["name"],
                "state_code": loc["state_code"],
                "categories": loc.get("categories", []),
                "best_months": loc.get("best_months", []),
                "notes": loc.get("curated_notes", ""),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
            }
        )
    top = matched[:5]
    cards = [{"card_type": "place", "data": p} for p in top[:3]]
    return {"result": {"places": top}, "cards": cards, "citations": []}


async def _tool_specialities(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    sc = (args.get("state") or "").upper().strip()
    sp_type = (args.get("type") or "").lower().strip()
    filters = []
    if sc:
        filters.append(("state_code", "==", sc))
    if sp_type:
        filters.append(("type", "==", sp_type))
    specs = [localize_doc(s, lang) for s in repo.query_docs("specialities", filters=filters or None)]
    return {"result": {"specialities": specs[:6]}, "cards": [], "citations": []}


async def _tool_travel_options(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    f_name = (args.get("from_name") or args.get("from") or "Guwahati").lower()
    t_name = (args.get("to_name") or args.get("to") or "").lower()
    nodes = {n["id"]: n for n in repo.list_docs("transport_nodes")}
    opts = repo.list_docs("transport_options")
    matched = []
    for o in opts:
        fn = nodes.get(o["from_node_id"], {})
        tn = nodes.get(o["to_node_id"], {})
        f_txt = f"{localize(fn.get('name_i18n'), 'en')} {fn.get('state_code', '')}".lower()
        t_txt = f"{localize(tn.get('name_i18n'), 'en')} {tn.get('state_code', '')}".lower()
        if (not f_name or f_name in f_txt) and (not t_name or t_name in t_txt):
            matched.append(
                {
                    **o,
                    "from_name": localize(fn.get("name_i18n"), lang),
                    "to_name": localize(tn.get("name_i18n"), lang),
                }
            )
    cards = [{"card_type": "route", "data": m} for m in matched[:3]]
    return {"result": {"options": matched[:5]}, "cards": cards, "citations": []}


async def _tool_permits(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    dest = (args.get("destination") or "").strip()
    state_code = dest.upper() if len(dest) == 2 else None
    checklist = build_permit_checklist(
        repo=repo,
        citizen_type=profile.get("citizen_type", "indian"),
        nationality_code=profile.get("nationality_code", "IN"),
        date_of_birth=profile.get("date_of_birth"),
        destination_id=None if state_code else dest,
        state_code=state_code,
        start_date=args.get("start"),
        lang=lang,
    )
    cards = [{"card_type": "permit", "data": item} for item in checklist["items"]]
    citations = [
        {
            "permit_id": item["permit_id"],
            "code": item["code"],
            "name": item["name"],
            "portal_url": item["portal_url"],
            "last_verified_at": item["last_verified_at"],
            "needs_check": item["needs_check"],
        }
        for item in checklist["items"]
    ]
    return {"result": checklist, "cards": cards, "citations": citations}


async def _tool_alerts(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    sc = (args.get("area") or "").upper().strip()
    filters = [("state_code", "==", sc)] if len(sc) == 2 else None
    alerts = [localize_doc(a, lang) for a in repo.query_docs("alerts", filters=filters)]
    return {"result": {"alerts": alerts}, "cards": [], "citations": []}


async def _tool_search_trains(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    jdate = validate_journey_date(args.get("date"), allow_yesterday=False)
    res = await search_trains_service(
        str(args.get("from_code") or "GHY"),
        str(args.get("to_code") or "DMV"),
        jdate,
    )
    cards = [{"card_type": "train", "data": tr} for tr in (res.get("trains") or [])[:3]]
    return {"result": res, "cards": cards, "citations": []}


async def _tool_train_status(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    sdate = validate_journey_date(args.get("start_date") or args.get("date"), allow_yesterday=True)
    status_data = await get_live_status_service(str(args.get("train_no", "12067")), sdate)
    return {"result": status_data, "cards": [{"card_type": "train", "data": status_data}], "citations": []}


async def _tool_create_trip(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    sc_list = args.get("state_codes") or []
    trip = create_trip_with_days(
        repo=repo,
        owner_id=uid,
        title=args.get("title") or "North-East India Trip",
        origin_text=args.get("origin") or "Guwahati",
        state_codes=sc_list,
        start_date=args.get("start") or date.today().isoformat(),
        end_date=args.get("end") or date.today().isoformat(),
        party_size=int(args.get("party_size") or 2),
        budget_inr=int(args.get("budget_inr") or 25000),
        status="draft",
        created_via="agent",
        citizen_type=profile.get("citizen_type", "indian"),
        nationality_code=profile.get("nationality_code", "IN"),
        date_of_birth=profile.get("date_of_birth"),
        lang=lang,
    )
    return {"result": {"trip_id": trip["id"], "trip": trip}, "cards": [], "citations": []}


async def _tool_add_trip_item(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    trip_id = args["trip_id"]
    trip = repo.get_doc("trips", trip_id)
    if not trip or (trip.get("owner_id") != uid and uid not in (trip.get("editor_ids") or [])):
        return {"result": {"error": "Trip not accessible"}, "cards": [], "citations": []}
    item = add_item_to_trip(
        repo=repo,
        trip_id=trip_id,
        day_index=int(args.get("day", 1)),
        item_type=args.get("type", "place"),
        title=args.get("title", "Stop"),
        ref_id=args.get("ref_id"),
        start_time=args.get("start_time"),
    )
    return {"result": {"item": item}, "cards": [], "citations": []}


async def _tool_estimate_budget(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    trip_id = args["trip_id"]
    est = estimate_trip_budget(repo, trip_id)
    full = get_full_trip(repo, trip_id)
    cards = []
    if full:
        cards.append(
            {
                "card_type": "trip_draft",
                "data": {
                    "trip_id": trip_id,
                    "title": full["title"],
                    "start_date": full["start_date"],
                    "end_date": full["end_date"],
                    "days_count": len(full.get("days", [])),
                    "items_count": len(full.get("items", [])),
                    "estimated_total_inr": est.get("estimated_total_inr"),
                    "target_budget_inr": full.get("budget_inr"),
                },
            }
        )
    return {"result": est, "cards": cards, "citations": []}


async def _tool_search_knowledge(args: Dict[str, Any], uid: str, repo: BaseNoSQLRepo, profile: Dict[str, Any], lang: str) -> Dict[str, Any]:
    q = (args.get("query") or "").lower().strip()
    target_lang = args.get("lang") or lang
    chunks = repo.query_docs("kb_chunks", filters=[("lang", "==", target_lang)])
    if not chunks:
        chunks = repo.query_docs("kb_chunks", filters=[("lang", "==", "en")])
    tokens = [t for t in q.split() if len(t) > 2]
    scored = []
    for ch in chunks:
        txt = ch.get("text", "").lower()
        score = sum(1 for tok in tokens if tok in txt)
        if score > 0:
            scored.append((score, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    hits = [s[1] for s in scored[:5]]
    citations = [
        {"permit_id": h.get("source_id"), "last_verified_at": h.get("last_verified_at")}
        for h in hits
        if h.get("source_type") == "permit"
    ]
    return {"result": {"chunks": hits}, "cards": [], "citations": citations}


_TOOL_HANDLERS = {
    "get_user_profile": _tool_user_profile,
    "search_places": _tool_search_places,
    "get_specialities": _tool_specialities,
    "get_travel_options": _tool_travel_options,
    "get_permits": _tool_permits,
    "get_alerts": _tool_alerts,
    "search_trains": _tool_search_trains,
    "get_train_status": _tool_train_status,
    "create_trip": _tool_create_trip,
    "add_trip_item": _tool_add_trip_item,
    "estimate_budget": _tool_estimate_budget,
    "search_knowledge": _tool_search_knowledge,
}


async def execute_agent_tool(
    tool_name: str,
    args: Dict[str, Any],
    uid: str,
    repo: BaseNoSQLRepo,
) -> Dict[str, Any]:
    """Execute one agent tool using user permissions, returning {result, cards, citations}."""
    handler = _TOOL_HANDLERS.get(tool_name)
    if handler is None:
        return {"result": {"error": f"Unknown tool: {tool_name}"}, "cards": [], "citations": []}
    profile = repo.get_doc("user_profiles", uid) or {}
    lang = profile.get("preferred_lang", "en")
    return await handler(args, uid, repo, profile, lang)
