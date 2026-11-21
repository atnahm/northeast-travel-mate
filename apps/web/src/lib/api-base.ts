/**
 * Normalizes API_BASE_URL across local dev, Docker Compose, and cloud hosts (Render / Vercel / Railway).
 * Handles values entered with or without http(s):// protocol and provides a sensible production fallback.
 */
export function getBackendBaseUrl(): string {
  const raw = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!raw) {
    return process.env.NODE_ENV === "production"
      ? "https://ne-mate-api.onrender.com"
      : "http://127.0.0.1:8000";
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (
    raw.startsWith("localhost") ||
    raw.startsWith("127.0.0.1") ||
    raw.startsWith("api:") ||
    raw.includes(":8000") ||
    raw.includes(":10000")
  ) {
    return `http://${raw}`;
  }
  return `https://${raw}`;
}
