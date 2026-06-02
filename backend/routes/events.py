import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from starlette.requests import Request

import models
from auth import get_current_user
from events import event_bus

router = APIRouter(tags=["events"])


@router.get("/api/events")
async def sse(request: Request, user: models.User = Depends(get_current_user)):
    q: asyncio.Queue = asyncio.Queue()
    event_bus.subscribe(user.id, q)

    async def generator():
        try:
            yield 'data: {"type":"connected"}\n\n'
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20)
                    yield f'data: {json.dumps(event)}\n\n'
                except asyncio.TimeoutError:
                    # Keepalive comment so proxies don't close the connection
                    yield ': keepalive\n\n'
        except Exception:
            pass
        finally:
            event_bus.unsubscribe(user.id, q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # disable nginx buffering for SSE
        },
    )
