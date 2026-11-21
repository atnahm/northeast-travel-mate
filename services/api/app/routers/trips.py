from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.models.schemas import (
    ExpenseCreateRequest,
    PackingToggleRequest,
    TripCreateRequest,
    TripDayCreateRequest,
    TripGenerateRequest,
    TripItemCreateRequest,
    TripItemPatchRequest,
    TripMemberInviteRequest,
    TripPatchRequest,
    TripReorderRequest,
)
from services.common.repository import BaseNoSQLRepo, utc_now_iso
from services.common.trip_ops import (
    add_item_to_trip,
    create_trip_with_days,
    generate_structured_trip,
    get_full_trip,
)

router = APIRouter(prefix="/api/v1/trips", tags=["trips"])


def _require_trip_access(repo: BaseNoSQLRepo, trip_id: str, uid: str, write: bool = False) -> dict:
    trip = repo.get_doc("trips", trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    is_member = trip.get("owner_id") == uid or uid in (trip.get("member_ids") or [])
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this trip")
    if write:
        can_edit = trip.get("owner_id") == uid or uid in (trip.get("editor_ids") or [])
        if not can_edit:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Read-only trip member cannot edit")
    return trip


@router.get("")
def list_my_trips(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trips = repo.query_docs("trips", filters=[("member_ids", "array-contains", user.uid)], order_by="updated_at", descending=True)
    return {"items": trips}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_trip(
    body: TripCreateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    profile = repo.get_doc("user_profiles", user.uid) or {}
    trip = create_trip_with_days(
        repo=repo,
        owner_id=user.uid,
        title=body.title,
        origin_text=body.origin_text,
        state_codes=body.state_codes,
        start_date=body.start_date,
        end_date=body.end_date,
        party_size=body.party_size,
        budget_inr=body.budget_inr,
        status=body.status,
        created_via=body.created_via,
        citizen_type=profile.get("citizen_type", "indian"),
        nationality_code=profile.get("nationality_code", "IN"),
        date_of_birth=profile.get("date_of_birth"),
        lang=profile.get("preferred_lang", user.preferred_lang),
    )
    return {"trip": get_full_trip(repo, trip["id"])}


@router.post("/generate", status_code=status.HTTP_201_CREATED)
def generate_trip(
    body: TripGenerateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    profile = repo.get_doc("user_profiles", user.uid) or {}
    full = generate_structured_trip(
        repo=repo,
        owner_id=user.uid,
        destination_state=body.destination_state,
        days=body.days,
        start_date=body.start_date,
        origin=body.origin,
        interests=body.interests,
        budget_inr=body.budget_inr,
        party_size=body.party_size,
        citizen_type=profile.get("citizen_type", "indian"),
        nationality_code=profile.get("nationality_code", "IN"),
        date_of_birth=profile.get("date_of_birth"),
        lang=profile.get("preferred_lang", user.preferred_lang),
        created_via="agent",
    )
    return {"trip": full}


@router.get("/{trip_id}")
def get_trip(
    trip_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=False)
    return {"trip": get_full_trip(repo, trip_id)}


@router.patch("/{trip_id}")
def patch_trip(
    trip_id: str,
    body: TripPatchRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    current_version = int(trip.get("version", 1))
    if body.expected_version is not None and body.expected_version != current_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Version conflict: server is at v{current_version}, client sent v{body.expected_version}",
        )
    updates = {k: v for k, v in body.model_dump(exclude={"expected_version"}).items() if v is not None}
    updates["version"] = current_version + 1
    repo.update_doc("trips", trip_id, updates)
    return {"trip": get_full_trip(repo, trip_id)}


@router.delete("/{trip_id}")
def delete_trip(
    trip_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    if trip.get("owner_id") != user.uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the trip owner can delete a trip")
    for sub in ("days", "items", "permit_tasks", "expenses", "packing"):
        repo.clear_subcollection("trips", trip_id, sub)
    repo.delete_doc("trips", trip_id)
    return {"deleted": True, "trip_id": trip_id}


@router.post("/{trip_id}/days")
def add_trip_day(
    trip_id: str,
    body: TripDayCreateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=True)
    day = repo.set_subdoc(
        "trips",
        trip_id,
        "days",
        f"day_{body.day_index}",
        {"trip_id": trip_id, "day_index": body.day_index, "date": body.date, "notes": body.notes},
        merge=True,
    )
    return {"day": day}


@router.post("/{trip_id}/items", status_code=status.HTTP_201_CREATED)
def create_trip_item(
    trip_id: str,
    body: TripItemCreateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=True)
    # Ensure day exists
    day_id = f"day_{body.day_index}"
    if not repo.get_subdoc("trips", trip_id, "days", day_id):
        repo.set_subdoc("trips", trip_id, "days", day_id, {"trip_id": trip_id, "day_index": body.day_index, "notes": ""})
    item = add_item_to_trip(
        repo=repo,
        trip_id=trip_id,
        day_index=body.day_index,
        item_type=body.type,
        title=body.title,
        position=body.position,
        google_place_id=body.google_place_id,
        ref_id=body.ref_id,
        start_time=body.start_time,
        end_time=body.end_time,
        lat=body.lat,
        lng=body.lng,
        payload=body.payload,
        status=body.status,
    )
    return {"item": item}


@router.patch("/{trip_id}/items/{item_id}")
def patch_trip_item(
    trip_id: str,
    item_id: str,
    body: TripItemPatchRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    existing = repo.get_subdoc("trips", trip_id, "items", item_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip item not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    saved = repo.set_subdoc("trips", trip_id, "items", item_id, {**existing, **updates})
    repo.update_doc("trips", trip_id, {"version": int(trip.get("version", 1)) + 1})
    return {"item": saved}


@router.delete("/{trip_id}/items/{item_id}")
def delete_trip_item(
    trip_id: str,
    item_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    deleted = repo.delete_subdoc("trips", trip_id, "items", item_id)
    repo.update_doc("trips", trip_id, {"version": int(trip.get("version", 1)) + 1})
    return {"deleted": deleted}


@router.post("/{trip_id}/reorder")
def reorder_trip_items(
    trip_id: str,
    body: TripReorderRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    for entry in body.items:
        iid = entry.get("id")
        if not iid:
            continue
        existing = repo.get_subdoc("trips", trip_id, "items", iid)
        if existing:
            repo.set_subdoc(
                "trips",
                trip_id,
                "items",
                iid,
                {
                    **existing,
                    "day_index": entry.get("day_index", existing.get("day_index", 1)),
                    "position": entry.get("position", existing.get("position", 0)),
                },
            )
    repo.update_doc("trips", trip_id, {"version": int(trip.get("version", 1)) + 1})
    return {"trip": get_full_trip(repo, trip_id)}


@router.post("/{trip_id}/members")
def invite_trip_member(
    trip_id: str,
    body: TripMemberInviteRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = _require_trip_access(repo, trip_id, user.uid, write=True)
    if trip.get("owner_id") != user.uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can invite co-travelers")

    # Find invited user by email if they already have a profile; otherwise record pending invite
    matches = repo.query_docs("user_profiles", filters=[("email", "==", body.email.strip().lower())])
    member_ids = list(trip.get("member_ids") or [])
    editor_ids = list(trip.get("editor_ids") or [])
    members = list(trip.get("members") or [])

    if matches:
        uid = matches[0]["id"]
        if uid not in member_ids:
            member_ids.append(uid)
        if body.role == "editor" and uid not in editor_ids:
            editor_ids.append(uid)
        members = [m for m in members if m.get("user_id") != uid]
        members.append({"user_id": uid, "email": body.email, "role": body.role, "status": "joined"})
    else:
        members.append({"user_id": None, "email": body.email, "role": body.role, "status": "invited"})

    repo.update_doc("trips", trip_id, {"member_ids": member_ids, "editor_ids": editor_ids, "members": members})
    return {"trip": get_full_trip(repo, trip_id)}


@router.get("/{trip_id}/export")
def export_trip(
    trip_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=False)
    full = get_full_trip(repo, trip_id)
    return {"export_format": "ne_mate_offline_trip_v1", "exported_at": utc_now_iso(), "trip": full}


@router.get("/{trip_id}/expenses")
def list_expenses(
    trip_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=False)
    items = repo.list_subdocs("trips", trip_id, "expenses", order_by="spent_at", descending=True)
    return {"items": items}


@router.post("/{trip_id}/expenses", status_code=status.HTTP_201_CREATED)
def add_expense(
    trip_id: str,
    body: ExpenseCreateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=True)
    eid = f"exp_{uuid.uuid4().hex[:10]}"
    saved = repo.set_subdoc(
        "trips",
        trip_id,
        "expenses",
        eid,
        {
            "id": eid,
            "trip_id": trip_id,
            "paid_by": body.paid_by,
            "amount_inr": body.amount_inr,
            "category": body.category,
            "note": body.note,
            "spent_at": body.spent_at or utc_now_iso(),
            "split_between": body.split_between or [body.paid_by],
        },
    )
    return {"expense": saved}


@router.patch("/{trip_id}/packing/{item_id}")
def toggle_packing_item(
    trip_id: str,
    item_id: str,
    body: PackingToggleRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    _require_trip_access(repo, trip_id, user.uid, write=True)
    existing = repo.get_subdoc("trips", trip_id, "packing", item_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Packing item not found")
    saved = repo.set_subdoc("trips", trip_id, "packing", item_id, {**existing, "checked": body.checked})
    return {"item": saved}
