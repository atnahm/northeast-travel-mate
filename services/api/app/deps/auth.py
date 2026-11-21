from __future__ import annotations

from urllib.parse import unquote
from dataclasses import dataclass
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, status

from services.common.config import get_settings
from services.common.firebase_client import get_firebase_auth, get_resolved_mode
from services.common.repository import BaseNoSQLRepo, get_repo


@dataclass
class AuthUser:
    uid: str
    email: Optional[str]
    name: Optional[str]
    role: str
    preferred_lang: str = "en"
    auth_mode: str = "firebase"


def _extract_token(authorization: Optional[str], cookie_token: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if cookie_token:
        return cookie_token.strip()
    return None


def _verify_token_string(token: str) -> tuple[str, Optional[str], Optional[str], str]:
    """
    Verify either:
      - Real Firebase ID Token / Session Cookie (when Firebase Auth is active)
      - Local Dev Token `dev:<uid>[:<role>]` (ONLY when DEV_AUTH_BYPASS=true and Firebase is in local fallback mode)
    Returns (uid, email, name, auth_mode).
    """
    settings = get_settings()
    mode = get_resolved_mode()

    if token.startswith("poc:"):
        # Cloud PoC fallback token used when a newly deployed preview domain (e.g. *.onrender.com)
        # has not yet been added to Firebase Console Authorized Domains. Still stores all profile,
        # trip, permit, and document data in live Cloud Firestore!
        parts = token.split(":")
        uid = f"poc_{parts[1]}" if len(parts) > 1 and parts[1] else "poc_traveler"
        email = unquote(parts[2]) if len(parts) > 2 and parts[2] else f"{uid}@nemate.in"
        name = unquote(parts[3]) if len(parts) > 3 and parts[3] else uid.replace("_", " ").title()
        return uid, email, name, "cloud_poc"

    if token.startswith("dev:"):
        parts = token.split(":")
        uid = parts[1] if len(parts) > 1 and parts[1] else "demo_traveler"
        return uid, f"{uid}@nemate.in", uid.replace("_", " ").title(), "local_dev"

    fb_auth = get_firebase_auth()
    if fb_auth is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token for local mode.",
        )

    try:
        decoded = fb_auth.verify_id_token(token, check_revoked=False)
        return (
            decoded["uid"],
            decoded.get("email"),
            decoded.get("name"),
            "firebase_id_token",
        )
    except Exception:
        try:
            decoded = fb_auth.verify_session_cookie(token, check_revoked=False)
            return (
                decoded["uid"],
                decoded.get("email"),
                decoded.get("name"),
                "firebase_session_cookie",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired Firebase token: {exc}",
            ) from exc


def get_repo_dep() -> BaseNoSQLRepo:
    return get_repo()


def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    ne_mate_session: Optional[str] = Cookie(default=None),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> Optional[AuthUser]:
    token = _extract_token(authorization, ne_mate_session)
    if not token:
        return None
    uid, email, name, auth_mode = _verify_token_string(token)
    profile = repo.get_doc("user_profiles", uid)
    role = "traveler"
    preferred_lang = "en"
    if profile:
        # Role MUST come from server-side DB, never from client headers/body
        role = profile.get("role", "traveler")
        preferred_lang = profile.get("preferred_lang", "en")
    elif token.startswith("dev:") and len(token.split(":")) >= 3 and get_settings().dev_auth_bypass:
        # Allow local test seeding of an admin/editor role only in dev bypass mode
        role = token.split(":")[2]

    user = AuthUser(
        uid=uid,
        email=email or (profile or {}).get("email"),
        name=name or (profile or {}).get("full_name"),
        role=role,
        preferred_lang=preferred_lang,
        auth_mode=auth_mode,
    )
    request.state.auth_uid = uid
    return user


def get_current_user(user: Optional[AuthUser] = Depends(get_optional_user)) -> AuthUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Sign in with Google or Email.",
        )
    return user


def require_editor_or_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if user.role not in ("editor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor or admin role required.",
        )
    return user
