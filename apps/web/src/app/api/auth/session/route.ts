import { NextRequest, NextResponse } from "next/server";

const API_BASE = (process.env.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const COOKIE_NAME = "ne_mate_session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = String(body?.idToken || "").trim();
    if (!idToken) {
      return NextResponse.json({ error: { code: "missing_token", message: "idToken is required" } }, { status: 400 });
    }

    const upstream = await fetch(`${API_BASE}/api/v1/auth/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    const res = NextResponse.json(data, { status: 200 });
    res.cookies.set(COOKIE_NAME, idToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60, // 60 minutes (B4.6)
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: { code: "session_error", message: err instanceof Error ? err.message : "Failed to establish session" } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
