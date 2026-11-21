# NE Mate — GitHub & Production Deployment Guide

This repository is pre-configured with strict secret exclusions (`.gitignore`, `.dockerignore`), production Dockerfiles (`infra/Dockerfile.api`, `infra/Dockerfile.web`), and a Render Blueprint (`render.yaml`).

---

## 1. Push to GitHub

1. Create a new empty repository on GitHub (for example, `https://github.com/<your-username>/northeast-travel-mate.git`).
2. Link your local Git repository and push the `main` branch:
   ```powershell
   git remote add origin https://github.com/<your-username>/northeast-travel-mate.git
   git branch -M main
   git push -u origin main
   ```
   > **Security check**: `.env`, `apps/web/.env.local`, and `service-account.json` are excluded by `.gitignore` and will never be pushed to GitHub.

---

## 2. Option A: Deploy Frontend to Vercel + Backend to Render / Railway / Cloud Run

### Step A1 — Deploy FastAPI Backend (`services/api`)
You can deploy the backend using `infra/Dockerfile.api` on **Render**, **Railway**, or **Google Cloud Run**:

- **Build Context**: `.` (repository root, because `services/api` reads `data/trains/` and `data/seed/`)
- **Dockerfile Path**: `infra/Dockerfile.api`
- **Health Check Path**: `/api/v1/health`
- **Environment Variables**:
  | Variable | Production Value |
  | :--- | :--- |
  | `APP_ENV` | `production` |
  | `FIREBASE_MODE` | `firestore` |
  | `FIREBASE_PROJECT_ID` | `ne-travel-mate` |
  | `FIREBASE_DATABASE_ID` | `(default)` |
  | `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste the single-line JSON contents of your `service-account.json` |
  | `DEV_AUTH_BYPASS` | `false` |
  | `GOOGLE_MAPS_SERVER_KEY` | Your Google Maps Server API key |
  | `LLM_PROVIDER` | `gemini` |
  | `LLM_API_KEY` | Your Gemini API key |
  | `LLM_MODEL` | `gemini-3.8-flash` |
  | `RAPIDAPI_LIVE_ENABLED` | `false` |
  | `ALLOWED_ORIGINS` | `https://your-vercel-domain.vercel.app` |

### Step A2 — Deploy Next.js PWA Frontend (`apps/web`) on Vercel
1. Import your GitHub repository into **Vercel**.
2. Set **Root Directory** to `apps/web`.
3. In Vercel Project Settings -> **General**, enable **"Include source files outside of the Root Directory in the Build Step"** (so `packages/shared` and `data/trains` are accessible).
4. Add the environment variables from `apps/web/.env.example`:
   - `API_BASE_URL` = `https://your-backend-service.onrender.com` (your deployed FastAPI URL)
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
5. In **Firebase Console -> Authentication -> Settings -> Authorized domains**, add your Vercel domain (`your-vercel-domain.vercel.app`) so Google Sign-In works in production.

---

## 3. Option B: Full-Stack Docker Compose Deployment (VPS / Cloud VM)

To run the entire stack (FastAPI + Agent + Worker + Redis + Next.js Web) on any server with Docker:

```bash
cp .env.example .env
# Fill in .env values, then launch:
docker compose -f infra/docker-compose.yml up --build -d
```
