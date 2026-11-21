from __future__ import annotations

import base64
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.api.app.models.schemas import DocumentCreateRequest, UploadUrlRequest
from services.common.config import get_settings
from services.common.firebase_client import get_storage_bucket
from services.common.repository import BaseNoSQLRepo

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.post("/upload-url")
def create_upload_url(
    body: UploadUrlRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict:
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    safe_name = "".join(c for c in body.filename if c.isalnum() or c in (".", "-", "_")) or "file.pdf"
    storage_key = f"ne-docs/{user.uid}/{doc_id}_{safe_name}"

    bucket = get_storage_bucket()
    if bucket is not None:
        try:
            blob = bucket.blob(storage_key)
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=5),
                method="PUT",
                content_type=body.content_type,
            )
            return {"doc_id": doc_id, "storage_key": storage_key, "upload_url": signed_url, "mode": "firebase_storage"}
        except Exception:
            pass

    return {
        "doc_id": doc_id,
        "storage_key": storage_key,
        "upload_url": None,
        "mode": "local_vault",
    }


@router.get("")
def list_documents(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    items = repo.list_subdocs("user_profiles", user.uid, "documents", order_by="created_at", descending=True)
    # Strip raw base64 payloads on list for low-data mode
    clean = [{k: v for k, v in item.items() if k != "content_base64"} for item in items]
    return {"items": clean}


@router.post("", status_code=status.HTTP_201_CREATED)
def register_document(
    body: DocumentCreateRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    # Save optional base64 payload locally for dev convenience (never in Firestore document above 1MB)
    if body.content_base64:
        uploads_dir = get_settings().local_uploads_dir / user.uid
        uploads_dir.mkdir(parents=True, exist_ok=True)
        raw_b64 = body.content_base64.split(",", 1)[-1]
        try:
            file_bytes = base64.b64decode(raw_b64)
            (uploads_dir / f"{doc_id}.bin").write_bytes(file_bytes)
        except Exception:
            pass

    saved = repo.set_subdoc(
        "user_profiles",
        user.uid,
        "documents",
        doc_id,
        {
            "id": doc_id,
            "owner_id": user.uid,
            "kind": body.kind,
            "title": body.title,
            "storage_key": body.storage_key,
            "mime_type": body.mime_type,
            "size_bytes": body.size_bytes,
            "encrypted": body.encrypted,
            "expires_at": body.expires_at,
        },
    )
    return {"document": saved}


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    existing = repo.get_subdoc("user_profiles", user.uid, "documents", doc_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    repo.delete_subdoc("user_profiles", user.uid, "documents", doc_id)
    return {"deleted": True, "id": doc_id}
