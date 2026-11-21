export type LangCode = "en" | "hi" | "as" | "bn";
export type CitizenType = "indian" | "oci_pio" | "foreign";
export type PermitTaskStatus = "not_started" | "applied" | "approved" | "rejected" | "expired";
export type PlaceCategory = "food" | "culture" | "nature" | "trek" | "wildlife" | "stay";

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  date_of_birth: string;
  nationality_code: string;
  citizen_type: CitizenType;
  preferred_lang: LangCode;
  guardian_consent: boolean;
  location_consent: boolean;
  notifications_consent: boolean;
  low_data_mode: boolean;
  role: "traveler" | "editor" | "admin";
  onboarding_completed_at?: string;
}

export interface NEState {
  id: string;
  code: string;
  name: string;
  name_i18n: Record<string, string>;
  capital: string;
  tagline: string;
  tagline_i18n: Record<string, string>;
  center: { lat: number; lng: number };
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number };
  best_months: number[];
  pack_size_mb: number;
  pack_version: string;
}

export interface Place {
  id: string;
  google_place_id: string;
  state_code: string;
  name: string;
  name_i18n: Record<string, string>;
  categories: PlaceCategory[];
  lat: number;
  lng: number;
  best_months: number[];
  permit_area_id?: string | null;
  permit_area_name?: string;
  is_featured: boolean;
  hours?: string;
  how_to_reach?: string;
  curated_notes: string;
  curated_notes_i18n: Record<string, string>;
  distance_km?: number;
}

export interface Speciality {
  id: string;
  state_code: string;
  type: "dish" | "craft" | "product" | "festival";
  name: string;
  name_i18n: Record<string, string>;
  description: string;
  where_to_find: string;
  season_months: number[];
}

export interface PermitChecklistItem {
  permit_id: string;
  code: string;
  name: string;
  description: string;
  area_id: string;
  area_name: string;
  state_code: string;
  required: boolean;
  status: string;
  issuing_authority: string;
  portal_url: string;
  source_url: string;
  fee_text: string;
  processing_time_text: string;
  validity_text: string;
  documents_required: string[];
  rule_notes: string;
  last_verified_at: string;
  verified_by: string;
  version: number;
  needs_check: boolean;
}

export interface PermitChecklistResponse {
  profile_summary: {
    citizen_type: CitizenType;
    nationality_code: string;
    age: number | null;
  };
  resolved_areas: Array<{ id: string; state_code: string; kind: string; name: string }>;
  items: PermitChecklistItem[];
  notice: string;
}

export interface TransportOption {
  id: string;
  mode: "self_drive" | "shared_sumo" | "bus" | "train" | "flight" | "ferry";
  operator: string;
  from_name?: string;
  to_name?: string;
  distance_km?: number;
  typical_duration_min: number;
  fare_min_inr: number;
  fare_max_inr: number;
  schedule_text: string;
  permit_checkpoints?: string[];
  warnings?: string[];
  source_url?: string;
  last_verified_at: string;
}

export interface TripItem {
  id: string;
  trip_id: string;
  day_index: number;
  position: number;
  type: "place" | "travel_leg" | "train" | "stay" | "meal" | "permit_task" | "note";
  google_place_id?: string;
  ref_id?: string;
  title: string;
  start_time?: string;
  end_time?: string;
  lat?: number;
  lng?: number;
  payload: Record<string, unknown>;
  status: string;
}

export interface Trip {
  id: string;
  owner_id: string;
  title: string;
  origin_text: string;
  state_codes: string[];
  start_date: string;
  end_date: string;
  party_size: number;
  budget_inr: number;
  status: "draft" | "planned" | "active" | "completed";
  created_via: "manual" | "agent";
  version: number;
  days?: Array<{ trip_id: string; day_index: number; date?: string; notes?: string }>;
  items?: TripItem[];
  permit_tasks?: Array<{
    id: string;
    permit_id: string;
    permit_name: string;
    state_code: string;
    portal_url: string;
    last_verified_at?: string;
    needs_check?: boolean;
    status: PermitTaskStatus;
    reference_no?: string;
  }>;
  expenses?: Array<{
    id: string;
    paid_by: string;
    amount_inr: number;
    category: string;
    note: string;
    spent_at: string;
    split_between: string[];
  }>;
  packing?: Array<{ id: string; category: string; label: string; checked: boolean }>;
  budget_summary?: {
    estimated_total_inr: number;
    per_person_estimated_inr: number;
    logged_expenses_inr: number;
    target_budget_inr: number;
    estimated_breakdown_inr: Record<string, number>;
  };
}

export interface AlertItem {
  id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  state_code: string;
  lat: number;
  lng: number;
  title: string;
  body: string;
  source_url: string;
  starts_at: string;
  ends_at: string;
  verified: boolean;
  last_verified_at?: string;
}

export interface ChatCard {
  card_type: "place" | "route" | "permit" | "trip_draft" | "train";
  data: Record<string, unknown>;
}

export interface ChatCitation {
  permit_id: string;
  code?: string;
  name?: string;
  portal_url?: string;
  last_verified_at?: string;
  needs_check?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
  citations?: ChatCitation[];
  created_at?: string;
}

// --- Trains Module Types ---
export type DataSource = "live" | "cached" | "scheduled_fallback";
export type WeekdayCode = "M" | "T" | "W" | "Th" | "F" | "Sa" | "Su";

export interface TrainSummary {
  trainNo: string;
  name: string;
  type: string;
  fromCode: string;
  toCode: string;
  departure: string; // ISO with +05:30
  arrival: string;
  durationMin: number;
  arrivalDayOffset: number;
  runsOn: WeekdayCode[];
  runsOnSelectedDate: boolean | null;
  classes: string[];
  source: DataSource;
  fetchedAt: string | null;
  provider: string;
}

export interface TrainStop {
  stationCode: string;
  stationName: string;
  distanceKm: number | null;
  schedArr: string | null;
  schedDep: string | null;
  expArr: string | null;
  expDep: string | null;
  delayMin: number | null;
  haltMin: number | null;
  platform: string | null;
  passed: boolean;
}

export interface TrainRoute {
  trainNo: string;
  name: string;
  type: string;
  stops: TrainStop[];
  source: DataSource;
  fetchedAt: string | null;
  provider: string;
}

export interface LiveStatus {
  trainNo: string;
  startDate: string;
  state: "not_started" | "running" | "terminated" | "cancelled" | "diverted" | "unavailable";
  currentStationCode: string | null;
  nextStationCode: string | null;
  delayMin: number | null;
  stops: TrainStop[];
  fetchedAt: string | null;
  provider: string;
  source: DataSource;
  message?: string | null;
  trainName?: string | null;
  trainType?: string | null;
  disclaimer?: string;
}

export interface TrainSearchResponse {
  fromCode: string;
  toCode: string;
  date: string;
  sameRailhead: boolean;
  source: DataSource;
  verifiedAt: string | null;
  provider: string;
  trains: TrainSummary[];
  disclaimer?: string;
  fallbackReason?: string;
}

export interface StationEntry {
  code: string;
  name: string;
  stateCode: string;
  lat: number;
  lng: number;
}

export interface RailheadOption {
  code: string;
  name: string;
  isPrimary: boolean;
  modes: string[];
  roadKm?: number | null;
  driveMinutes?: number | null;
  lat?: number;
  lng?: number;
  road?: {
    status: string;
    lastVerifiedAt: string | null;
    source: string | null;
  };
}

export interface PermitHint {
  mayRequirePermit: boolean;
  stateCode?: string;
  permitAreaId?: string;
  count?: number;
  permitsPath: string;
}

export interface RailheadDestination {
  id: string;
  name: string;
  aliases: string[];
  stateCode: string;
  lat: number;
  lng: number;
  permitAreaId?: string;
  hasDirectRail: boolean;
  railheads: RailheadOption[];
  legs?: Array<{ mode: string; label: string; typicalMinutes?: number; lastVerifiedAt?: string | null }>;
  permitHint?: PermitHint | null;
}

export interface SavedTrainRecord {
  id: string; // `${trainNo}_${startDate}`
  trainNo: string;
  name: string;
  type: string;
  fromCode?: string;
  toCode?: string;
  startDate: string;
  savedAt: string;
  route?: TrainRoute | null;
  liveStatus?: LiveStatus | null;
}
