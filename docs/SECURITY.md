# NorthEast TravelMate — Security & DPDP Privacy Compliance

## 1. Zero Secret Leakage Policy

- **No Hardcoded Keys in Source or Dockerfiles**: All API keys (`GOOGLE_MAPS_SERVER_KEY`, `LLM_API_KEY`, `RAPIDAPI_RAILWAY_KEY`, `NEXT_PUBLIC_FIREBASE_API_KEY`) and service account credentials (`FIREBASE_SERVICE_ACCOUNT_JSON` / `service-account.json`) are loaded strictly from environment variables at runtime.
- **Git & Docker Exclusions**:
  - `.gitignore` blocks `.env`, `.env.*`, `apps/web/.env*`, `*service-account*.json`, `*firebase-adminsdk*.json`, `*.tsbuildinfo`, `data/.local_db/`, and `data/.local_uploads/`.
  - `.dockerignore` prevents local secrets and virtual environments from ever entering Docker image layers.
- **Runtime Public Config Injection**: `GET /api/auth/config` (`apps/web/src/app/api/auth/config/route.ts`) reads public Firebase Web SDK identifiers from container runtime environment variables so Docker images never need keys baked into `Dockerfile.web`.

---

## 2. Authentication & Session Security

- **HTTP-Only Session Cookies**:
  - When a user signs in via Firebase Authentication (`Google` or `Email/Password`), the client exchanges the ID token at `POST /api/auth/session`.
  - The server verifies the token via `firebase-admin` and sets an `HttpOnly; SameSite=Lax` cookie (`ne_mate_session`, 60-minute max-age, `Secure` in production).
  - Client-side `localStorage` is restricted strictly to non-sensitive UI preferences (`theme`, `lang`, `lowDataMode`, `selectedState` in `apps/web/src/lib/store/app-store.ts`).
- **Server-Authoritative Role-Based Access Control (RBAC)**:
  - User roles (`traveler`, `editor`, `admin`) are resolved exclusively from the server-side `user_profiles` document in Cloud Firestore (`services/api/app/deps/auth.py`), never from client request bodies or headers.

---

## 3. India DPDP Act (2023) Compliance

- **Minor Protection (Under-18 Guardian Consent Gate)**:
  - `PUT /api/v1/me` computes the traveler's age from `date_of_birth`. If the traveler is under 18 and `guardian_consent` is not `true`, the server rejects onboarding with `HTTP 422 Unprocessable Content` (verified by `test_dpdp_under_18_guardian_consent_and_onboarding`).
- **Itemized Consent Audit Trail**:
  - Every profile update records timestamped, policy-versioned (`2026.1`) consent receipts (`privacy_policy`, `location`, `notifications`, `guardian`) with a truncated SHA-256 IP hash in `user_profiles/{uid}/consents`.
- **Right to Erasure (1-Click Account Deletion)**:
  - `DELETE /api/v1/me` permanently removes the user's profile, subcollections (`consents`, `saved_places`, `emergency_contacts`), trips (`days`, `items`, `permits`, `expenses`), vault documents, and chat threads.

---

## 4. API Hardening & Rate Limiting

- **Sliding-Window Rate Limiter**:
  - Global middleware (`services/api/app/main.py`) enforces 60 requests/min per IP for general endpoints and 10 requests/min for AI chat streaming, plus dedicated per-user/IP buckets on `/api/v1/trains/*`.
- **Security Headers**:
  - Every API response includes `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Request-Id`, and `X-RateLimit-Remaining`.
