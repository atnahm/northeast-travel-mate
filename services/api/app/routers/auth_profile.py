from __future__ import annotations

import hashlib
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.models.schemas import ConsentRecordRequest, ProfileUpdateRequest
from services.common.config import get_settings
from services.common.permit_engine import compute_age
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1", tags=["profile"])


@router.post("/auth/session")
def establish_session(
    request: Request,
    response: Response,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    """Confirm verified Firebase or dev token, optionally set HTTP-only session cookie, and check onboarding state."""
    profile = repo.get_doc("user_profiles", user.uid)
    settings = get_settings()
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        response.set_cookie(
            key="ne_mate_session",
            value=token,
            httponly=True,
            samesite="lax",
            secure=(settings.app_env == "production"),
            max_age=3600,
            path="/",
        )
    return {
        "uid": user.uid,
        "email": user.email,
        "role": user.role,
        "auth_mode": user.auth_mode,
        "onboarding_completed": bool(profile and profile.get("onboarding_completed_at")),
        "profile": profile,
    }


@router.post("/auth/logout")
def logout_session(response: Response) -> dict:
    response.delete_cookie("ne_mate_session", path="/")
    return {"ok": True}


@router.get("/me")
def get_me(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    profile = repo.get_doc("user_profiles", user.uid)
    return {
        "uid": user.uid,
        "email": user.email,
        "role": user.role,
        "onboarding_completed": bool(profile and profile.get("onboarding_completed_at")),
        "profile": profile,
    }


@router.put("/me")
def upsert_me(
    body: ProfileUpdateRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    age = compute_age(body.date_of_birth)
    if age is not None and age < 18 and not body.guardian_consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Under India's DPDP Act, travelers under 18 require guardian_consent=true to complete onboarding.",
        )

    existing = repo.get_doc("user_profiles", user.uid) or {}
    now = utc_now_iso()
    profile_data = {
        "id": user.uid,
        "email": user.email or existing.get("email"),
        "full_name": body.full_name,
        "date_of_birth": body.date_of_birth,
        "nationality_code": body.nationality_code.upper(),
        "citizen_type": body.citizen_type,
        "preferred_lang": body.preferred_lang,
        "guardian_consent": body.guardian_consent,
        "location_consent": body.location_consent,
        "notifications_consent": body.notifications_consent,
        "low_data_mode": body.low_data_mode,
        # Preserve authoritative server-stored role; default to traveler
        "role": existing.get("role") or user.role or "traveler",
        "onboarding_completed_at": existing.get("onboarding_completed_at") or now,
    }
    saved = repo.set_doc("user_profiles", user.uid, profile_data, merge=True)

    # Record DPDP consent snapshot
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]
    for ctype, granted in (
        ("privacy_policy", True),
        ("location", body.location_consent),
        ("notifications", body.notifications_consent),
        ("guardian", body.guardian_consent),
    ):
        cid = f"c_{ctype}_{uuid.uuid4().hex[:8]}"
        repo.set_subdoc(
            "user_profiles",
            user.uid,
            "consents",
            cid,
            {
                "user_id": user.uid,
                "consent_type": ctype,
                "policy_version": "2026.1",
                "granted": granted,
                "granted_at": now,
                "ip_hash": ip_hash,
            },
        )

    return {"profile": saved, "onboarding_completed": True}


@router.get("/me/consents")
def list_consents(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    items = repo.list_subdocs("user_profiles", user.uid, "consents", order_by="granted_at", descending=True)
    return {"items": items}


@router.post("/me/consents")
def record_consent(
    body: ConsentRecordRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    now = utc_now_iso()
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]
    cid = f"c_{body.consent_type}_{uuid.uuid4().hex[:8]}"
    entry = repo.set_subdoc(
        "user_profiles",
        user.uid,
        "consents",
        cid,
        {
            "user_id": user.uid,
            "consent_type": body.consent_type,
            "policy_version": body.policy_version,
            "granted": body.granted,
            "granted_at": now,
            "ip_hash": ip_hash,
        },
    )
    if body.consent_type in ("location", "notifications", "guardian"):
        field = f"{body.consent_type}_consent"
        repo.update_doc("user_profiles", user.uid, {field: body.granted})
    return {"consent": entry}


@router.delete("/me")
def delete_my_account(
    response: Response,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    """DPDP-compliant full account deletion (profile, owned trips, documents, chats, push subs + audit log)."""
    uid = user.uid
    # Delete user subcollections
    for sub in ("consents", "emergency_contacts", "saved_places", "documents", "push_subscriptions", "notifications"):
        repo.clear_subcollection("user_profiles", uid, sub)

    # Delete owned trips & their subcollections
    owned_trips = repo.query_docs("trips", filters=[("owner_id", "==", uid)])
    for trip in owned_trips:
        for sub in ("days", "items", "permit_tasks", "expenses", "packing"):
            repo.clear_subcollection("trips", trip["id"], sub)
        repo.delete_doc("trips", trip["id"])

    # Delete chat threads & messages
    threads = repo.query_docs("chat_threads", filters=[("user_id", "==", uid)])
    for th in threads:
        repo.clear_subcollection("chat_threads", th["id"], "messages")
        repo.delete_doc("chat_threads", th["id"])

    repo.delete_doc("user_profiles", uid)

    audit_id = f"del_{uuid.uuid4().hex[:10]}"
    repo.set_doc(
        "audit_log",
        audit_id,
        {
            "action": "account_deleted",
            "subject_uid_hash": hashlib.sha256(uid.encode("utf-8")).hexdigest()[:16],
            "deleted_trips_count": len(owned_trips),
            "deleted_threads_count": len(threads),
            "timestamp": utc_now_iso(),
        },
    )
    response.delete_cookie("ne_mate_session", path="/")
    return {"deleted": True, "audit_id": audit_id}
