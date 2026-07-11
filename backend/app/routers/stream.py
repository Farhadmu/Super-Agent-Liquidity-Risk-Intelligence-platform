import json
import asyncio
from typing import List
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

# Global subscriber queue list
_queues: List[asyncio.Queue] = []

@router.get("/api/stream")
async def sse_stream(request: Request):
    q = asyncio.Queue()
    _queues.append(q)
    
    async def event_generator():
        try:
            # Send initial connection success message
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for message with 15-second keep-alive ping fallback
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"event: {data['event']}\ndata: {json.dumps(data['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if q in _queues:
                _queues.remove(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def broadcast_event(event_type: str, data: dict):
    """Broadcast an event payload to all active SSE subscribers."""
    for q in list(_queues):
        try:
            q.put_nowait({"event": event_type, "data": data})
        except Exception:
            # Handle potential closed queues safely
            pass
