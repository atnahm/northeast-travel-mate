import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api-base";

export async function proxyTrainGet(req: NextRequest, backendPath: string) {
  const API_BASE = getBackendBaseUrl();
  const qs = req.nextUrl.search || "";
  const headers = new Headers();
  const cookie = req.cookies.get("ne_mate_session")?.value;
  if (cookie) headers.set("authorization", `Bearer ${cookie}`);

  try {
    const upstream = await fetch(`${API_BASE}${backendPath}${qs}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "trains_backend_unreachable", message: err instanceof Error ? err.message : "Train API unavailable" } },
      { status: 503 }
    );
  }
}
