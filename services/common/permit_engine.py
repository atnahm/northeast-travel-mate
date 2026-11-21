from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from services.common.geo import resolve_permit_areas
from services.common.i18n import localize
from services.common.repository import BaseNoSQLRepo

OFFICIAL_PORTAL_NOTICE = (
    "Always confirm permit requirements, fees, and current office hours on the official government portal before you travel."
)
STALE_VERIFICATION_DAYS = 90


def compute_age(date_of_birth: Optional[str], on_date: Optional[date] = None) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        dob = date.fromisoformat(date_of_birth[:10])
    except ValueError:
        return None
    ref = on_date or date.today()
    return ref.year - dob.year - ((ref.month, ref.day) < (dob.month, dob.day))


def is_verification_stale(last_verified_at: Optional[str], threshold_days: int = STALE_VERIFICATION_DAYS) -> bool:
    if not last_verified_at:
        return True
    try:
        verified_dt = datetime.fromisoformat(last_verified_at.replace("Z", "+00:00"))
        if verified_dt.tzinfo is None:
            verified_dt = verified_dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - verified_dt
        return delta.days > threshold_days
    except ValueError:
        return True


def build_permit_checklist(
    repo: BaseNoSQLRepo,
    citizen_type: str = "indian",
    nationality_code: str = "IN",
    date_of_birth: Optional[str] = None,
    destination_id: Optional[str] = None,
    state_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    start_date: Optional[str] = None,
    lang: str = "en",
) -> Dict[str, Any]:
    """
    Evaluate personalized permit requirements using curated Firestore/NoSQL permit_areas,
    permit_rules, and permits (B6 Permit checklist logic).
    """
    ref_date = None
    if start_date:
        try:
            ref_date = date.fromisoformat(start_date[:10])
        except ValueError:
            ref_date = None

    age = compute_age(date_of_birth, on_date=ref_date)
    areas = resolve_permit_areas(
        repo,
        destination_id=destination_id,
        state_code=state_code,
        lat=lat,
        lng=lng,
    )
    area_ids = {a["id"] for a in areas}
    area_lookup = {a["id"]: a for a in areas}

    all_rules = repo.list_docs("permit_rules")
    all_permits = {p["id"]: p for p in repo.list_docs("permits")}

    # Group matched rules per permit_id so we evaluate both required & informational matches cleanly
    matched_by_permit: Dict[str, Dict[str, Any]] = {}
    for rule in all_rules:
        if rule.get("area_id") not in area_ids:
            continue
        allowed_citizens = rule.get("citizen_types") or [rule.get("citizen_type")]
        if citizen_type not in allowed_citizens:
            continue

        min_age = rule.get("min_age")
        max_age = rule.get("max_age")
        if age is not None:
            if min_age is not None and age < min_age:
                continue
            if max_age is not None and age > max_age:
                continue

        permit = all_permits.get(rule.get("permit_id", ""))
        if not permit or permit.get("status") == "retired":
            continue

        pid = permit["id"]
        area = area_lookup.get(rule["area_id"], {})
        required = bool(rule.get("required", True))

        existing = matched_by_permit.get(pid)
        # Prefer required=True and more specific areas if multiple rules match the same permit
        if existing and existing["required"] and not required:
            continue

        last_verified = permit.get("last_verified_at")
        stale = is_verification_stale(last_verified)
        matched_by_permit[pid] = {
            "permit_id": pid,
            "code": permit.get("code", pid),
            "name": localize(permit.get("name_i18n"), lang),
            "description": localize(permit.get("description_i18n"), lang),
            "area_id": rule["area_id"],
            "area_name": localize(area.get("name_i18n"), lang),
            "state_code": area.get("state_code", permit.get("state_code")),
            "required": required,
            "status": permit.get("status", "active"),
            "issuing_authority": permit.get("issuing_authority", ""),
            "portal_url": permit.get("portal_url", ""),
            "source_url": permit.get("source_url", permit.get("portal_url", "")),
            "fee_text": permit.get("fee_text", "₹ --- (confirm on official portal)"),
            "processing_time_text": permit.get("processing_time_text", ""),
            "validity_text": permit.get("validity_text", ""),
            "documents_required": permit.get("documents_required", []),
            "rule_notes": localize(rule.get("notes_i18n"), lang),
            "conditions": rule.get("conditions") or {},
            "last_verified_at": last_verified,
            "verified_by": permit.get("verified_by", ""),
            "version": permit.get("version", 1),
            "needs_check": stale,
        }

    items = list(matched_by_permit.values())
    items.sort(key=lambda x: (not x["required"], x["name"]))

    return {
        "profile_summary": {
            "citizen_type": citizen_type,
            "nationality_code": nationality_code,
            "age": age,
        },
        "resolved_areas": [
            {
                "id": a["id"],
                "state_code": a.get("state_code"),
                "kind": a.get("kind"),
                "name": localize(a.get("name_i18n"), lang),
            }
            for a in areas
        ],
        "items": items,
        "notice": OFFICIAL_PORTAL_NOTICE,
    }
