from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from services.api.app.deps.auth import AuthUser, get_repo_dep, require_editor_or_admin
from services.api.app.models.schemas import AdminAlertUpsert, AdminPermitUpsert, AdminVerifyPermitRequest
from services.common.i18n import SUPPORTED_LANGS, localize
from services.common.permit_engine import is_verification_stale
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _log_audit(repo: BaseNoSQLRepo, actor_uid: str, collection: str, doc_id: str, action: str, note: str = "") -> None:
    repo.set_doc(
        "audit_log",
        f"aud_{uuid.uuid4().hex[:10]}",
        {
            "actor_uid": actor_uid,
            "collection": collection,
            "doc_id": doc_id,
            "action": action,
            "note": note,
            "timestamp": utc_now_iso(),
        },
    )


def _reembed_permit_chunks(repo: BaseNoSQLRepo, permit: dict) -> None:
    for lang in SUPPORTED_LANGS:
        text = (
            f"Permit {permit['code']} ({permit['state_code']}): {localize(permit.get('name_i18n'), lang)}. "
            f"{localize(permit.get('description_i18n'), lang)} "
            f"Authority: {permit.get('issuing_authority')}. Portal: {permit.get('portal_url')}. "
            f"Last verified: {permit.get('last_verified_at')}."
        )
        repo.set_doc(
            "kb_chunks",
            f"kb_permit_{permit['id']}_{lang}",
            {
                "source_type": "permit",
                "source_id": permit["id"],
                "state_code": permit.get("state_code"),
                "lang": lang,
                "text": text,
                "last_verified_at": permit.get("last_verified_at"),
            },
        )


@router.get("/permits")
def admin_list_permits(
    _: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    permits = repo.list_docs("permits", order_by="state_code")
    for p in permits:
        p["needs_check"] = is_verification_stale(p.get("last_verified_at"))
    return {"items": permits}


@router.post("/permits")
def admin_upsert_permit(
    body: AdminPermitUpsert,
    actor: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    pid = body.id or f"perm_{body.state_code.lower()}_{uuid.uuid4().hex[:6]}"
    existing = repo.get_doc("permits", pid) or {}
    next_version = int(existing.get("version", 0)) + 1
    data = {
        **existing,
        **body.model_dump(exclude={"id"}),
        "id": pid,
        "version": next_version,
        # Saving as draft until verified by a second reviewer (B12)
        "last_verified_at": existing.get("last_verified_at"),
        "verified_by": existing.get("verified_by"),
    }
    saved = repo.set_doc("permits", pid, data)
    _log_audit(repo, actor.uid, "permits", pid, "upsert_draft")
    return {"permit": saved}


@router.post("/permits/{permit_id}/verify")
def admin_verify_permit(
    permit_id: str,
    body: AdminVerifyPermitRequest,
    actor: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    permit = repo.get_doc("permits", permit_id)
    if not permit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permit not found")

    now = utc_now_iso()
    new_ver = int(permit.get("version", 1)) + 1
    rules = repo.query_docs("permit_rules", filters=[("permit_id", "==", permit_id)])

    updated = repo.update_doc(
        "permits",
        permit_id,
        {
            "last_verified_at": now,
            "verified_by": actor.email or actor.uid,
            "version": new_ver,
        },
    )
    # Immutable audit snapshot in permit_versions (B5.1 & B12)
    snap_id = f"{permit_id}_v{new_ver}_{uuid.uuid4().hex[:6]}"
    repo.set_doc(
        "permit_versions",
        snap_id,
        {
            "id": snap_id,
            "permit_id": permit_id,
            "version": new_ver,
            "permit_snapshot": updated,
            "rules_snapshot": rules,
            "changed_by": actor.email or actor.uid,
            "change_note": body.change_note,
            "verified_at": now,
        },
    )
    if updated:
        _reembed_permit_chunks(repo, updated)
    _log_audit(repo, actor.uid, "permits", permit_id, "verify", body.change_note)
    return {"permit": updated, "snapshot_id": snap_id}


@router.get("/alerts")
def admin_list_alerts(
    _: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    return {"items": repo.list_docs("alerts", order_by="starts_at", descending=True)}


@router.post("/alerts")
def admin_upsert_alert(
    body: AdminAlertUpsert,
    actor: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    aid = body.id or f"alert_{body.state_code.lower()}_{uuid.uuid4().hex[:6]}"
    saved = repo.set_doc(
        "alerts",
        aid,
        {
            **body.model_dump(exclude={"id"}),
            "id": aid,
            "last_verified_at": utc_now_iso(),
        },
    )
    _log_audit(repo, actor.uid, "alerts", aid, "upsert")
    return {"alert": saved}


@router.delete("/alerts/{alert_id}")
def admin_delete_alert(
    alert_id: str,
    actor: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    deleted = repo.delete_doc("alerts", alert_id)
    _log_audit(repo, actor.uid, "alerts", alert_id, "delete")
    return {"deleted": deleted}


@router.get("/overdue")
def admin_overdue_report(
    _: AuthUser = Depends(require_editor_or_admin),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    overdue_permits = [p for p in repo.list_docs("permits") if is_verification_stale(p.get("last_verified_at"), threshold_days=90)]
    overdue_transport = [
        t for t in repo.list_docs("transport_options") if is_verification_stale(t.get("last_verified_at"), threshold_days=14)
    ]
    return {
        "overdue_permits": overdue_permits,
        "overdue_transport": overdue_transport,
        "audit_recent": repo.list_docs("audit_log", order_by="timestamp", descending=True, limit=20),
    }
