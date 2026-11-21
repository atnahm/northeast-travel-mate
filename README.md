# NorthEast TravelMate (NE Mate) — PS08: North East Tourism Explorer

**Problem Statement**: `PS08 — TravelMateNE: North East Tourism Explorer`  
**Domain**: `Tourism & Culture`

> *"North East India is home to diverse cultures, beautiful landscapes and numerous tourist destinations. However, travellers often struggle to discover local attractions, understand travel options and plan affordable trips. Develop a tourism discovery platform that encourages people to explore North East India and makes travel planning easier and more accessible."*

---

## 1. Problem Statement Alignment (PS08)

| PS08 Challenge | How NorthEast TravelMate Solves It | Key Modules |
| :--- | :--- | :--- |
| **1. Discover Local Attractions & Diverse Cultures** | • **28+ Curated Destinations** across all 8 states (**Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura**) with authentic landmark photography, field logistics, and interactive Web Mercator Street & Terrain maps.<br>• **Regional Cuisine, Handloom & Heritage Crafts** directory (`specialities`).<br>• **Cultural Festivals & Indigenous Celebrations** calendar (Hornbill, Bohag Bihu, Wangala, Ziro Festival of Music, Sangai Festival, Chapchar Kut).<br>• **6-Language Offline Phrasebook** (Assamese, Bengali, Hindi, Mizo, Nagamese, Nepali) with Web Speech audio playback. | `/explore`<br>`/explore/[id]`<br>`/phrasebook` |
| **2. Understand Travel Options & Entry Permits** | • **NFR Train & Last-Mile Guide**: 269 North-East railway stations, 215 scheduled NFR trains, zero-API local autocomplete, nearest-railhead resolution (e.g., *Kaziranga → Furkating*, *Tawang → Rangapara North*, *Aizawl → Sairang*), and onward road/ferry bridge cards.<br>• **Multi-Modal Route Planner**: Compares **Shared Tata Sumo, ASTC/State Bus, Train, Flight, Brahmaputra Ferry, and Self-Drive** legs with realistic cost ranges and travel times.<br>• **Verified ILP / PAP / RAP Permit Engine**: Computes exact permit requirements by state, zone, citizen category (`Indian`, `OCI/PIO`, `Foreign`), and age, citing official government portals. | `/travel`<br>`/permits` |
| **3. Plan Affordable Trips Easily & Accessibly** | • **Budget-Aware Trip Generator & Expense Splitter**: Generates editable day-by-day itineraries tailored to a target INR budget (`₹`) and party size, with itemized cost estimation (transport, stay, food, permits) and group expense splitting.<br>• **Agentic AI Assistant ("Ask Mate")**: Multi-step tool-calling assistant (`gemini-3.8-flash` + deterministic orchestrator) that autonomously checks permits, finds trains/routes, and creates saved day-by-day itineraries in Cloud Firestore.<br>• **Offline-First & Low-Data Mode**: Downloadable state packs in IndexedDB (Dexie), Service Worker caching, and Low-Data Mode for 2G/edge hill corridors. | `/trips`<br>`/trips/[id]`<br>`/chat`<br>`/settings` |

---

## 2. Submission Evaluation Matrix (6 Parameters)

### 1. Code Quality
- **Strict Type Safety**: TypeScript `strict: true` across `apps/web` and `packages/shared` (`tsc --noEmit` verified in CI) paired with Python 3.12 Pydantic v2 schemas (`services/api/app/models/schemas.py`).
- **Clean Layered Monorepo Architecture**:
  - `apps/web`: Next.js 15 App Router PWA, React 19, Tailwind CSS, TanStack Query, Zustand, Dexie IndexedDB.
  - `packages/shared`: Shared TypeScript contracts, OpenAPI spec generator, and typed API client.
  - `services/api` & `services/agent` & `services/common`: FastAPI Core REST API, SSE Tool-Calling Agent, pluggable `RailwayProvider` & `BaseNoSQLRepo` repository pattern.

### 2. Security
- **HTTP-Only Session Cookies**: Firebase ID tokens are exchanged via `POST /api/auth/session` into `HttpOnly; SameSite=Lax` cookies (`ne_mate_session`). Auth tokens are **never** stored in `localStorage`.
- **Server-Side RBAC & Firestore Rules**: User roles are read exclusively from server-side `user_profiles` documents; least-privilege rules in `infra/firebase/firestore.rules` and `storage.rules`.
- **DPDP Act Compliance**: Under-18 guardian consent enforcement (`HTTP 422` without `guardian_consent=true`), itemized consent audit log (`consents` subcollection), and 1-click full account & data erasure (`DELETE /api/v1/me`).
- **API Hardening**: Per-IP & per-user sliding-window rate limiting (`X-RateLimit-Remaining`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and strict server-side parameter validation.

### 3. Efficiency
- **Zero-API Local Railhead & Station Autocomplete**: Instant client/server autocomplete across 14 NE destinations and 269 NFR stations with 0 external network calls.
- **Multi-Tier TTL Caching**: Backend cache (`services/common/cache.py` — Redis or thread-safe in-memory TTL cache) caches railhead bundles (30 min), train searches by `from:to:weekday` (24 hr), and live train status (10 min).Same-railhead queries (e.g., *Guwahati → Shillong*) short-circuit with 0 provider calls.
- **Offline-First & Low-Data Mode**: IndexedDB (`Dexie`) stores offline state packs, phrasebooks, saved trains, and an optimistic sync outbox (`POST /api/v1/sync`); Low-Data Mode suppresses heavy media on mountain networks.

### 4. Testing
- **30 Automated Pytest Integration & Unit Tests** (`services/api/tests/`):
  - `test_permits.py` (16 tests): Covers the 8-state × citizen-type (`indian`, `oci_pio`, `foreign`) × under-18 permit rule matrix, retired permit filtering, and `>90d` staleness flagging.
  - `test_trains.py` (9 tests): Covers NFR corridor searches, nearest-railhead resolution, same-railhead zero-provider short-circuit, verified permit hints, Today vs Yesterday start-date caching, and input validation.
  - `test_api_flows.py` (5 tests): Covers health check, DPDP under-18 guardian consent, trip generation, optimistic offline sync conflict detection, account deletion, RBAC, cultural festivals discovery, multi-modal routes, and security headers.
- **Automated CI/CD Pipeline** (`.github/workflows/ci-cd.yml`): Runs `pytest`, `tsc --noEmit`, `next build`, and publishes multi-stage Docker images to GitHub Container Registry (`ghcr.io`).

### 5. Accessibility (WCAG 2.2 AA)
- **Verified Color Contrast & Non-Color Status Cues**: Tokenized Light & Dark mode palettes documented in `docs/DESIGN_SYSTEM.md` (`>= 4.5:1` contrast); every `StatusBadge` combines distinct shape, border style (solid vs dashed), icon, and text label.
- **Keyboard & Screen-Reader Navigation**: Skip-to-main-content link (`#main-content`), `aria-current="page"` navigation landmarks, combobox/listbox ARIA roles on station autocomplete, `role="alert"` on error states, and `>= 44px–48px` touch targets.
- **Multilingual & Indic Typography**: UI localization in **English, Hindi (हिन्दी), Assamese (অসমীয়া), and Bengali (বাংলা)** with `1.65–1.7` Indic line-height so tall matras and conjuncts never clip.
- **Accidental-Dial Prevention on 112 SOS**: 2-second press-and-hold gesture + 3-second cancellable countdown before dialing `112`.

---

## 3. Quick Start (Local Development)

1. **Copy environment template & seed baseline data**:
   ```powershell
   copy .env.example .env
   .\.venv\Scripts\python.exe data/seed/seed_firestore.py --target local
   ```
2. **Run backend test suite & FastAPI server**:
   ```powershell
   .\.venv\Scripts\python.exe -m pytest services/api/tests -v
   .\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --reload --port 8000
   ```
3. **Run Next.js PWA frontend**:
   ```powershell
   npm --prefix apps/web run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

For cloud deployment instructions (Render, Vercel, Docker Compose, and GitHub Actions CI/CD), see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
