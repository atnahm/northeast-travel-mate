from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.models.schemas import PushSubscribeRequest, SyncRequest
from services.common.i18n import localize_doc
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1", tags=["offline_and_sync"])


@router.get("/offline/packs")
def list_offline_packs(
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    states = repo.list_docs("states", order_by="code")
    packs = [
        {
            "state_code": s["code"],
            "name": localize_doc(s, lang).get("name", s["code"]),
            "pack_size_mb": s.get("pack_size_mb", 30.0),
            "pack_version": s.get("pack_version", "2026.11.1"),
            "includes": ["OSM coordinate geometry", "Places & specialities", "Verified permits", "Phrasebook & helplines"],
            "attribution": "Offline map data © OpenStreetMap contributors",
        }
        for s in states
    ]
    return {"items": packs}


@router.get("/offline/packs/{state_code}/manifest")
def download_offline_pack(
    state_code: str,
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    sc = state_code.upper()
    state = repo.get_doc("states", sc)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="State pack not found")

    places = [localize_doc(p, lang) for p in repo.query_docs("places", filters=[("state_code", "==", sc)])]
    specialities = [localize_doc(sp, lang) for sp in repo.query_docs("specialities", filters=[("state_code", "==", sc)])]
    permits = [localize_doc(pm, lang) for pm in repo.query_docs("permits", filters=[("state_code", "==", sc)])]
    permit_rules = repo.query_docs("permit_rules", filters=[("state_code", "==", sc)])
    alerts = [localize_doc(a, lang) for a in repo.query_docs("alerts", filters=[("state_code", "==", sc)])]
    helplines = [h for h in repo.list_docs("helplines") if h.get("state_code") in (sc, "ALL")]
    phrasebook = repo.list_docs("phrasebook")
    transport_nodes = [localize_doc(n, lang) for n in repo.query_docs("transport_nodes", filters=[("state_code", "==", sc)])]

    return {
        "state": localize_doc(state, lang),
        "pack_version": state.get("pack_version", "2026.11.1"),
        "downloaded_at": utc_now_iso(),
        "attribution": "Offline map data © OpenStreetMap contributors",
        "bundle": {
            "places": places,
            "specialities": specialities,
            "permits": permits,
            "permit_rules": permit_rules,
            "alerts": alerts,
            "helplines": helplines,
            "phrasebook": phrasebook,
            "transport_nodes": transport_nodes,
        },
    }


@router.post("/sync")
def sync_offline_outbox(
    body: SyncRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    """Process offline queued writes with optimistic per-item version conflict detection (B9.3)."""
    applied: List[str] = []
    conflicts: List[Dict[str, Any]] = []

    for op in body.operations:
        if op.entity == "saved_places":
            if op.action == "delete":
                repo.delete_subdoc("user_profiles", user.uid, "saved_places", op.doc_id)
            else:
                repo.set_subdoc("user_profiles", user.uid, "saved_places", op.doc_id, op.data, merge=True)
            applied.append(op.op_id)
            continue

        if op.entity == "trips":
            existing = repo.get_doc("trips", op.doc_id)
            if existing:
                if existing.get("owner_id") != user.uid and user.uid not in (existing.get("editor_ids") or []):
                    conflicts.append({"op_id": op.op_id, "reason": "forbidden"})
                    continue
                server_ver = int(existing.get("version", 1))
                if op.base_version is not None and op.base_version < server_ver:
                    conflicts.append(
                        {
                            "op_id": op.op_id,
                            "entity": "trips",
                            "doc_id": op.doc_id,
                            "reason": "version_conflict",
                            "server_version": server_ver,
                            "server_data": existing,
                        }
                    )
                    continue
                if op.action == "delete":
                    repo.delete_doc("trips", op.doc_id)
                else:
                    merged = {**existing, **op.data, "version": server_ver + 1}
                    repo.set_doc("trips", op.doc_id, merged)
            elif op.action != "delete":
                payload = {
                    **op.data,
                    "id": op.doc_id,
                    "owner_id": user.uid,
                    "member_ids": [user.uid],
                    "editor_ids": [user.uid],
                    "version": 1,
                }
                repo.set_doc("trips", op.doc_id, payload)
            applied.append(op.op_id)
            continue

        if op.entity == "trip_permit_tasks" and op.parent_id:
            trip = repo.get_doc("trips", op.parent_id)
            if trip and (trip.get("owner_id") == user.uid or user.uid in (trip.get("editor_ids") or [])):
                repo.set_subdoc("trips", op.parent_id, "permit_tasks", op.doc_id, op.data, merge=True)
                applied.append(op.op_id)
            else:
                conflicts.append({"op_id": op.op_id, "reason": "trip_not_accessible"})
            continue

    latest_trips = repo.query_docs("trips", filters=[("member_ids", "array-contains", user.uid)])
    return {
        "synced_at": utc_now_iso(),
        "applied_op_ids": applied,
        "conflicts": conflicts,
        "server_trips": latest_trips,
    }


@router.post("/push/subscribe")
def subscribe_push(
    body: PushSubscribeRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    sub_id = f"ps_{uuid.uuid5(uuid.NAMESPACE_URL, body.endpoint).hex[:12]}"
    saved = repo.set_subdoc(
        "user_profiles",
        user.uid,
        "push_subscriptions",
        sub_id,
        {
            "id": sub_id,
            "user_id": user.uid,
            "endpoint": body.endpoint,
            "keys": body.keys,
            "device_label": body.device_label,
        },
    )
    return {"subscription": saved}


@router.delete("/push/subscribe")
def unsubscribe_push(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    removed = repo.clear_subcollection("user_profiles", user.uid, "push_subscriptions")
    return {"removed": removed}
