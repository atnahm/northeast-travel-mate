from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_optional_user, get_repo_dep
from services.api.app.models.schemas import TripPermitTaskPatchRequest
from services.common.i18n import localize_doc
from services.common.permit_engine import OFFICIAL_PORTAL_NOTICE, build_permit_checklist, is_verification_stale
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1", tags=["permits"])


@router.get("/permits/checklist")
def get_permit_checklist(
    destination_id: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
    start: Optional[str] = Query(default=None),
    citizen_type: Optional[str] = Query(default=None),
    nationality_code: Optional[str] = Query(default=None),
    date_of_birth: Optional[str] = Query(default=None),
    lang: Optional[str] = Query(default=None),
    user: Optional[AuthUser] = Depends(get_optional_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    profile = repo.get_doc("user_profiles", user.uid) if user else None
    resolved_citizen = citizen_type or (profile or {}).get("citizen_type") or "indian"
    resolved_nationality = nationality_code or (profile or {}).get("nationality_code") or "IN"
    resolved_dob = date_of_birth or (profile or {}).get("date_of_birth")
    resolved_lang = lang or (profile or {}).get("preferred_lang") or "en"

    return build_permit_checklist(
        repo=repo,
        citizen_type=resolved_citizen,
        nationality_code=resolved_nationality,
        date_of_birth=resolved_dob,
        destination_id=destination_id,
        state_code=state,
        lat=lat,
        lng=lng,
        start_date=start,
        lang=resolved_lang,
    )


@router.get("/permit-areas")
def list_permit_areas(
    state: Optional[str] = Query(default=None),
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    filters = [("state_code", "==", state.upper())] if state else None
    areas = repo.query_docs("permit_areas", filters=filters)
    return {"items": [localize_doc(a, lang) for a in areas]}


@router.get("/permits/{permit_id}")
def get_permit_detail(
    permit_id: str,
    lang: str = Query(default="en"),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    permit = repo.get_doc("permits", permit_id)
    if not permit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permit not found")
    out = localize_doc(permit, lang)
    out["needs_check"] = is_verification_stale(permit.get("last_verified_at"))
    out["notice"] = OFFICIAL_PORTAL_NOTICE
    return {"permit": out}


@router.patch("/trip-permit-tasks/{trip_id}/{task_id}")
def update_trip_permit_task(
    trip_id: str,
    task_id: str,
    body: TripPermitTaskPatchRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    trip = repo.get_doc("trips", trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.get("owner_id") != user.uid and user.uid not in (trip.get("editor_ids") or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted to modify this trip's permit tasks")

    existing = repo.get_subdoc("trips", trip_id, "permit_tasks", task_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permit task not found")

    updated = {
        **existing,
        "status": body.status,
        "reference_no": body.reference_no if body.reference_no is not None else existing.get("reference_no"),
        "valid_from": body.valid_from if body.valid_from is not None else existing.get("valid_from"),
        "valid_to": body.valid_to if body.valid_to is not None else existing.get("valid_to"),
        "document_id": body.document_id if body.document_id is not None else existing.get("document_id"),
        "updated_at": utc_now_iso(),
    }
    saved = repo.set_subdoc("trips", trip_id, "permit_tasks", task_id, updated)
    return {"task": saved}
