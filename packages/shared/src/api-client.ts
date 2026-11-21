/**
 * Typed HTTP + SSE client calling Next.js `/api/proxy/api/v1/*` (never holding secret tokens in localStorage).
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `/api/proxy${cleanPath}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const errJson = await resp.json();
      msg = errJson?.error?.message || errJson?.detail || msg;
    } catch {
      // ignore non-json error body
    }
    throw new Error(msg);
  }

  return (await resp.json()) as T;
}

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export async function streamChatSSE(
  threadId: string,
  content: string,
  onEvent: (ev: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const resp = await fetch(`/api/proxy/api/v1/chat/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    credentials: "include",
    signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Chat stream failed (${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      if (!frame.trim()) continue;
      let eventName = "message";
      let dataStr = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (dataStr) {
        try {
          onEvent({ event: eventName, data: JSON.parse(dataStr) });
        } catch {
          onEvent({ event: eventName, data: { text: dataStr } });
        }
      }
    }
  }
}
