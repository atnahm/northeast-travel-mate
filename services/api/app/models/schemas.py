from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    date_of_birth: str = Field(..., description="ISO YYYY-MM-DD")
    nationality_code: str = Field(default="IN", min_length=2, max_length=3)
    citizen_type: str = Field(default="indian", pattern="^(indian|oci_pio|foreign)$")
    preferred_lang: str = Field(default="en", pattern="^(en|hi|as|bn)$")
    guardian_consent: bool = False
    location_consent: bool = False
    notifications_consent: bool = False
    low_data_mode: bool = False


class ConsentRecordRequest(BaseModel):
    consent_type: str = Field(..., pattern="^(privacy_policy|location|notifications|guardian)$")
    policy_version: str = Field(default="2026.1")
    granted: bool


class SavedPlaceRequest(BaseModel):
    place_id: str
    google_place_id: Optional[str] = None
    title: Optional[str] = None
    state_code: Optional[str] = None
    note: str = ""


class TravelOptionsRequest(BaseModel):
    from_id: Optional[str] = None
    to_id: Optional[str] = None
    from_name: Optional[str] = None
    to_name: Optional[str] = None
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    date: Optional[str] = None


class RouteCalcRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    waypoints: List[Dict[str, float]] = Field(default_factory=list)
    travel_mode: str = Field(default="DRIVE", pattern="^(DRIVE|TRANSIT|WALK)$")


class TripCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    origin_text: str = Field(default="Guwahati")
    state_codes: List[str] = Field(default_factory=list)
    start_date: str
    end_date: str
    party_size: int = Field(default=1, ge=1, le=50)
    budget_inr: int = Field(default=15000, ge=0)
    status: str = Field(default="planned", pattern="^(draft|planned|active|completed)$")
    created_via: str = Field(default="manual", pattern="^(manual|agent)$")


class TripPatchRequest(BaseModel):
    title: Optional[str] = None
    origin_text: Optional[str] = None
    state_codes: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    party_size: Optional[int] = Field(default=None, ge=1, le=50)
    budget_inr: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = Field(default=None, pattern="^(draft|planned|active|completed)$")
    expected_version: Optional[int] = None


class TripDayCreateRequest(BaseModel):
    day_index: int = Field(..., ge=1, le=60)
    date: Optional[str] = None
    notes: str = ""


class TripItemCreateRequest(BaseModel):
    day_index: int = Field(..., ge=1, le=60)
    position: Optional[int] = None
    type: str = Field(..., pattern="^(place|travel_leg|train|stay|meal|permit_task|note)$")
    google_place_id: Optional[str] = None
    ref_id: Optional[str] = None
    title: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="planned")


class TripItemPatchRequest(BaseModel):
    day_index: Optional[int] = None
    position: Optional[int] = None
    title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class TripReorderRequest(BaseModel):
    items: List[Dict[str, Any]]  # [{ "id": "...", "day_index": 1, "position": 0 }]


class TripMemberInviteRequest(BaseModel):
    email: str
    role: str = Field(default="viewer", pattern="^(editor|viewer)$")


class TripPermitTaskPatchRequest(BaseModel):
    status: str = Field(..., pattern="^(not_started|applied|approved|rejected|expired)$")
    reference_no: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    document_id: Optional[str] = None


class ExpenseCreateRequest(BaseModel):
    paid_by: str
    amount_inr: float = Field(..., gt=0)
    category: str = Field(default="other")
    note: str = ""
    spent_at: Optional[str] = None
    split_between: List[str] = Field(default_factory=list)


class PackingToggleRequest(BaseModel):
    checked: bool


class TripGenerateRequest(BaseModel):
    destination_state: str
    days: int = Field(default=4, ge=1, le=21)
    start_date: Optional[str] = None
    origin: str = "Guwahati"
    interests: List[str] = Field(default_factory=list)
    budget_inr: int = Field(default=25000, ge=1000)
    party_size: int = Field(default=2, ge=1, le=30)


class EmergencyContactRequest(BaseModel):
    name: str
    phone: str
    relation: str = "Family"


class ShareLocationRequest(BaseModel):
    lat: float
    lng: float
    note: str = ""
    expires_minutes: int = Field(default=120, ge=15, le=1440)


class DocumentCreateRequest(BaseModel):
    kind: str = Field(..., pattern="^(permit|id_copy|ticket|other)$")
    title: str
    storage_key: str
    mime_type: str = "application/pdf"
    size_bytes: int = 0
    encrypted: bool = False
    expires_at: Optional[str] = None
    content_base64: Optional[str] = None


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str = "application/pdf"
    kind: str = "permit"


class SyncOutboxOperation(BaseModel):
    op_id: str
    entity: str  # trips | trip_items | saved_places | trip_permit_tasks
    action: str  # upsert | delete
    doc_id: str
    parent_id: Optional[str] = None
    base_version: Optional[int] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class SyncRequest(BaseModel):
    client_version: int = 0
    operations: List[SyncOutboxOperation] = Field(default_factory=list)


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: Dict[str, Any] = Field(default_factory=dict)
    device_label: str = "Web PWA"


class AdminPermitUpsert(BaseModel):
    id: Optional[str] = None
    code: str
    state_code: str
    name_i18n: Dict[str, str]
    description_i18n: Dict[str, str]
    issuing_authority: str
    portal_url: str
    source_url: str
    fee_text: str = "₹ --- (confirm on official portal)"
    processing_time_text: str = ""
    validity_text: str = ""
    documents_required: List[str] = Field(default_factory=list)
    status: str = Field(default="active", pattern="^(active|suspended|retired)$")


class AdminAlertUpsert(BaseModel):
    id: Optional[str] = None
    kind: str = Field(..., pattern="^(landslide|bandh|curfew|flood|fog|closure)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high)$")
    state_code: str
    lat: float = 26.1445
    lng: float = 91.7362
    title_i18n: Dict[str, str]
    body_i18n: Dict[str, str]
    source_url: str
    starts_at: str
    ends_at: str
    verified: bool = True


class AdminVerifyPermitRequest(BaseModel):
    change_note: str = "Verified against official government portal"
