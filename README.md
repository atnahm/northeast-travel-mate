# NE Mate — North-East India Travel Mate (v1.0)

An offline-first, trustworthy travel companion PWA for all eight North-Eastern states of India (**Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, and Tripura**).

## Architecture
- **Frontend (`apps/web`)**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, Dexie (IndexedDB offline store), Workbox-style PWA Service Worker, Google Maps JS API online + OpenStreetMap-attributed coordinate map offline.
- **Core API (`services/api`)**: Python 3.12 FastAPI (`/api/v1/*`), Firebase Auth verification, Google Places/Routes/Geocoding server integrations, pluggable `RailwayProvider` & `WeatherProvider`.
- **AI Agent (`services/agent`)**: Tool-calling travel assistant streaming via SSE (`POST /api/v1/chat/threads/{id}/messages`) supporting **Gemini** & **OpenAI-compatible** providers + structured fallback orchestrator. Permit answers are strictly grounded in `get_permits` citations.
- **Database & Auth**: **Firebase Authentication + Cloud Firestore (NoSQL) + Firebase Storage** (`infra/firebase/firestore.rules`, `firestore.indexes.json`, `storage.rules`), with an automatic local JSON NoSQL fallback (`data/.local_db/`) for zero-config local development.
- **Curated Data (`data/seed/`)**: Baseline seed across all **8 North-East states** (`seed_firestore.py`).

## Quick Start (Local Development)

1. **Copy environment template**:
   ```powershell
   copy .env.example .env
   ```
   *(Out of the box, `FIREBASE_MODE=auto` and `DEV_AUTH_BYPASS=true` run locally using `data/.local_db/`. To connect live **Cloud Firestore**, **Google Maps**, and **Gemini/OpenAI LLM**, see [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).)*

2. **Seed curated data for all 8 states**:
   ```powershell
   .venv\Scripts\python.exe data/seed/seed_firestore.py --target local
   ```

3. **Run backend API & tests**:
   ```powershell
   .venv\Scripts\pytest.exe services/api/tests -v
   .venv\Scripts\python.exe -m uvicorn services.api.app.main:app --reload --port 8000
   ```

4. **Run Next.js PWA frontend**:
   ```powershell
   npm --prefix apps/web run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).
