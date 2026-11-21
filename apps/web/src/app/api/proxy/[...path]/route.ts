import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api-base";

const COOKIE_NAME = "ne_mate_session";

async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const API_BASE = getBackendBaseUrl();
  const { path } = await params;
  const subPath = path.join("/");
  const search = req.nextUrl.search || "";
  const targetUrl = `${API_BASE}/${subPath}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const sessionToken = req.cookies.get(COOKIE_NAME)?.value;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    headers.set("authorization", authHeader);
  } else if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

    const respContentType = upstream.headers.get("content-type") || "application/json";
    if (respContentType.includes("text/event-stream") && upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const payload = await upstream.arrayBuffer();
    return new NextResponse(payload, {
      status: upstream.status,
      headers: { "Content-Type": respContentType },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "backend_unreachable",
          message:
            err instanceof Error
              ? `Core API unavailable (${err.message}). Start FastAPI on ${API_BASE}.`
              : "Backend API unreachable",
        },
      },
      { status: 503 }
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
