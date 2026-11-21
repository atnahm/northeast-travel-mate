from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.agent.app.llm_provider import run_agent_turn
from services.api.app.deps.auth import AuthUser, get_current_user, get_repo_dep
from services.common.repository import BaseNoSQLRepo, utc_now_iso

router = APIRouter(prefix="/api/v1/chat", tags=["chat_agent"])


class CreateThreadRequest(BaseModel):
    title: str = "New North-East Trip Chat"
    trip_id: Optional[str] = None
    lang: str = "en"


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("/threads")
def list_threads(
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    threads = repo.query_docs(
        "chat_threads",
        filters=[("user_id", "==", user.uid)],
        order_by="updated_at",
        descending=True,
    )
    return {"items": threads}


@router.post("/threads", status_code=status.HTTP_201_CREATED)
def create_thread(
    body: CreateThreadRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    tid = f"th_{uuid.uuid4().hex[:10]}"
    thread = repo.set_doc(
        "chat_threads",
        tid,
        {
            "id": tid,
            "user_id": user.uid,
            "title": body.title,
            "trip_id": body.trip_id,
            "lang": body.lang or user.preferred_lang,
        },
    )
    return {"thread": thread}


@router.get("/threads/{thread_id}")
def get_thread(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> dict:
    thread = repo.get_doc("chat_threads", thread_id)
    if not thread or thread.get("user_id") != user.uid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")
    messages = repo.list_subdocs("chat_threads", thread_id, "messages", order_by="created_at")
    return {"thread": thread, "messages": messages}


@router.post("/threads/{thread_id}/messages")
async def send_message_sse(
    thread_id: str,
    body: SendMessageRequest,
    user: AuthUser = Depends(get_current_user),
    repo: BaseNoSQLRepo = Depends(get_repo_dep),
) -> StreamingResponse:
    thread = repo.get_doc("chat_threads", thread_id)
    if not thread or thread.get("user_id") != user.uid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")

    history = repo.list_subdocs("chat_threads", thread_id, "messages", order_by="created_at")
    user_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    repo.set_subdoc(
        "chat_threads",
        thread_id,
        "messages",
        user_msg_id,
        {
            "id": user_msg_id,
            "thread_id": thread_id,
            "role": "user",
            "content": body.content,
            "created_at": utc_now_iso(),
        },
    )

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _sse("meta", {"thread_id": thread_id, "status": "thinking"})
        reply_text, cards, citations, tool_trace, engine = await run_agent_turn(
            message=body.content,
            history=history,
            uid=user.uid,
            repo=repo,
        )
        for tc in tool_trace:
            yield _sse("tool", tc)
        for card in cards:
            yield _sse("card", card)
        for cit in citations:
            yield _sse("citation", cit)

        # Stream tokens/words smoothly
        words = reply_text.split(" ")
        chunk_size = 6
        for i in range(0, len(words), chunk_size):
            piece = " ".join(words[i : i + chunk_size])
            if i + chunk_size < len(words):
                piece += " "
            yield _sse("delta", {"text": piece})
            await asyncio.sleep(0.01)

        asst_id = f"msg_{uuid.uuid4().hex[:10]}"
        saved = repo.set_subdoc(
            "chat_threads",
            thread_id,
            "messages",
            asst_id,
            {
                "id": asst_id,
                "thread_id": thread_id,
                "role": "assistant",
                "content": reply_text,
                "cards": cards,
                "citations": citations,
                "tool_calls": tool_trace,
                "engine": engine,
                "created_at": utc_now_iso(),
            },
        )
        if len(history) == 0:
            repo.update_doc("chat_threads", thread_id, {"title": body.content[:60]})

        yield _sse("done", {"message_id": saved["id"], "engine": engine})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
