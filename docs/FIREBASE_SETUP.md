# Firebase NoSQL + Auth + Storage Setup Guide (NE Mate)

NE Mate uses **Firebase Authentication**, **Cloud Firestore (NoSQL)**, and **Firebase Storage** instead of Supabase/PostgreSQL.

## 1. Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project ('NE-Travel-Mate`).
2. **Cloud Firestore**:
   - Create database in **Production mode**.
   - Select region **`asia-south1` (Mumbai)** for low latency and Indian data residency.
3. **Authentication**:
   - Go to **Authentication -> Sign-in method**.
   - Enable **Email/Password** (and optionally Email Link / Passwordless).
   - Enable **Google** sign-in and configure your OAuth consent screen & authorized domains (`localhost`, staging, production).
4. **Storage**:
   - Enable **Firebase Storage** in `asia-south1` (Mumbai).

## 2. Backend Service Account Setup
1. In Firebase Console -> **Project Settings -> Service Accounts**, click **Generate new private key**.
2. Save the downloaded JSON outside git tracking (e.g., `e:\travel mate\service-account.json`, which is gitignored by `*service-account*.json`).
3. Copy `.env.example` to `.env` and configure:
   ```env
   FIREBASE_MODE=firestore
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
   DEV_AUTH_BYPASS=false
   ```
   *(Alternatively, for containerized/CI deployments, pass raw JSON or base64 JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`.)*

## 3. Frontend Web SDK Setup
In Firebase Console -> **Project Settings -> Your apps -> Add Web App**:
Copy the `firebaseConfig` values into `.env` (and `apps/web/.env.local`):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 4. Google Maps Platform & LLM Setup
1. **Google Cloud Console -> APIs & Services**:
   - Enable **Maps JavaScript API** (for browser) -> restrict `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` by HTTP Referrer.
   - Enable **Places API (New)**, **Routes API**, and **Geocoding API** -> restrict `GOOGLE_MAPS_SERVER_KEY` by server IP.
   - Configure billing alerts & daily quotas on Day 1.
2. **LLM Provider (Server-Side Only)**:
   - Set `LLM_PROVIDER=gemini` with your Gemini API key in `LLM_API_KEY` (or `LLM_PROVIDER=openai` with OpenAI-compatible key/model/base URL).

## 5. Deploy Firestore Security Rules, Indexes & Storage Rules
From `infra/firebase/`:
```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 6. Seed All 8 North-East States into Cloud Firestore
```bash
.venv/Scripts/python.exe data/seed/seed_firestore.py --target firestore
```

## 7. Verify Live Connectivity
Start the API and check `GET http://127.0.0.1:8000/api/v1/health`:
It reports `"firebase": { "mode": "firestore", "connected": true, "project_id": "..." }`.

## Local Emulator Option
To run against Firebase Emulator Suite without touching live cloud data:
```bash
cd infra/firebase
firebase emulators:start
```
And set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_MODE=emulator`.
