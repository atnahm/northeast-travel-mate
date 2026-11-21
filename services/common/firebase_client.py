from __future__ import annotations

import base64
import json
import logging
import os
import threading
from typing import Any, Dict, Optional

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore, storage

from services.common.config import get_settings

logger = logging.getLogger("ne_mate.firebase")

_init_lock = threading.Lock()
_initialized_mode: Optional[str] = None
_firestore_client: Any = None
_firebase_app: Any = None


class FirebaseConfigurationError(RuntimeError):
    """Raised when FIREBASE_MODE requires live Firestore/Emulator but configuration is incomplete."""


def _parse_service_account_json(raw: str) -> Dict[str, Any]:
    text = raw.strip()
    if not text.startswith("{"):
        text = base64.b64decode(text).decode("utf-8")
    data = json.loads(text)
    if "private_key" in data and isinstance(data["private_key"], str):
        data["private_key"] = data["private_key"].replace("\\n", "\n")
    return data


def _apply_emulator_env() -> bool:
    settings = get_settings()
    using_emulator = False
    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
        using_emulator = True
    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host
        using_emulator = True
    if settings.firebase_storage_emulator_host:
        os.environ["FIREBASE_STORAGE_EMULATOR_HOST"] = settings.firebase_storage_emulator_host
        using_emulator = True
    return using_emulator


def _resolve_credential() -> tuple[Optional[credentials.Base], str]:
    """Return (credential_or_None, resolved_mode)."""
    settings = get_settings()
    mode = (settings.firebase_mode or "auto").lower().strip()

    if mode == "local":
        return None, "local"

    has_emulator = _apply_emulator_env()
    if mode == "emulator" or (mode == "auto" and has_emulator):
        if not settings.firestore_emulator_host:
            os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
        return None, "emulator"

    sa_path = settings.resolve_service_account_path()
    if sa_path is not None:
        if not sa_path.exists():
            if mode == "firestore":
                raise FirebaseConfigurationError(
                    f"FIREBASE_SERVICE_ACCOUNT_PATH does not exist: {sa_path}"
                )
            logger.warning("Service account path %s not found; falling back to local store.", sa_path)
            return None, "local"
        return credentials.Certificate(str(sa_path)), "firestore"

    if settings.firebase_service_account_json.strip():
        try:
            cert_dict = _parse_service_account_json(settings.firebase_service_account_json)
            return credentials.Certificate(cert_dict), "firestore"
        except Exception as exc:
            if mode == "firestore":
                raise FirebaseConfigurationError(
                    f"Invalid FIREBASE_SERVICE_ACCOUNT_JSON: {exc}"
                ) from exc
            logger.warning("Invalid FIREBASE_SERVICE_ACCOUNT_JSON (%s); falling back to local store.", exc)
            return None, "local"

    adc_path = (settings.google_application_credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")).strip()
    if adc_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = adc_path
        return credentials.ApplicationDefault(), "firestore"

    if mode == "firestore":
        raise FirebaseConfigurationError(
            "FIREBASE_MODE=firestore is set, but no credentials were provided. "
            "Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS."
        )

    return None, "local"


def init_firebase(force_mode: Optional[str] = None) -> str:
    """Thread-safe singleton initialization of Firebase Admin SDK (or local fallback)."""
    global _initialized_mode, _firestore_client, _firebase_app

    if _initialized_mode is not None and force_mode is None:
        return _initialized_mode

    with _init_lock:
        if _initialized_mode is not None and force_mode is None:
            return _initialized_mode

        settings = get_settings()
        if force_mode:
            settings_mode = force_mode.lower().strip()
        else:
            settings_mode = (settings.firebase_mode or "auto").lower().strip()

        if settings_mode == "local":
            _initialized_mode = "local"
            logger.info("NE Mate storage initialized in LOCAL JSON NoSQL mode (%s).", settings.local_db_dir)
            return _initialized_mode

        cred, resolved_mode = _resolve_credential()
        if resolved_mode == "local":
            _initialized_mode = "local"
            logger.warning(
                "No Firebase credentials or emulator detected; running in LOCAL JSON NoSQL fallback (%s). "
                "Configure FIREBASE_SERVICE_ACCOUNT_PATH or FIRESTORE_EMULATOR_HOST in .env for Cloud Firestore.",
                settings.local_db_dir,
            )
            return _initialized_mode

        options: Dict[str, Any] = {}
        project_id = settings.firebase_project_id
        if cred is not None and hasattr(cred, "project_id") and getattr(cred, "project_id"):
            project_id = getattr(cred, "project_id")
        if project_id:
            options["projectId"] = project_id
        bucket = settings.firebase_storage_bucket or (f"{project_id}.firebasestorage.app" if project_id else "")
        if bucket:
            options["storageBucket"] = bucket

        if not firebase_admin._apps:
            _firebase_app = firebase_admin.initialize_app(credential=cred, options=options)
        else:
            _firebase_app = firebase_admin.get_app()

        db_id = (settings.firebase_database_id or "(default)").strip()
        if db_id and db_id != "(default)":
            _firestore_client = firestore.client(app=_firebase_app, database_id=db_id)
        else:
            _firestore_client = firestore.client(app=_firebase_app)

        _initialized_mode = resolved_mode
        logger.info(
            "Firebase Admin initialized in %s mode (project_id=%s, database_id=%s).",
            _initialized_mode.upper(),
            project_id,
            db_id,
        )
        return _initialized_mode


def get_resolved_mode() -> str:
    return init_firebase()


def get_firestore_client() -> Any:
    mode = init_firebase()
    if mode == "local":
        return None
    return _firestore_client


def get_firebase_auth() -> Any:
    mode = init_firebase()
    if mode == "local":
        return None
    return fb_auth


def get_storage_bucket() -> Any:
    mode = init_firebase()
    settings = get_settings()
    if mode == "local" or not settings.firebase_storage_bucket:
        return None
    return storage.bucket(app=_firebase_app)


def reset_firebase_state_for_tests() -> None:
    global _initialized_mode, _firestore_client
    with _init_lock:
        _initialized_mode = None
        _firestore_client = None


def get_firebase_status() -> Dict[str, Any]:
    settings = get_settings()
    mode = init_firebase()
    connected = False
    detail = "local JSON store"
    if mode in ("firestore", "emulator"):
        try:
            client = get_firestore_client()
            # Lightweight metadata check without heavy reads
            _ = list(client.collection("states").limit(1).stream())
            connected = True
            detail = f"connected to {mode}"
        except Exception as exc:
            connected = False
            detail = f"connection check failed: {exc}"
    else:
        connected = True

    return {
        "mode": mode,
        "project_id": settings.firebase_project_id,
        "database_id": settings.firebase_database_id,
        "storage_bucket": settings.firebase_storage_bucket or None,
        "connected": connected,
        "detail": detail,
    }
