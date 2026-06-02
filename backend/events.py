import asyncio
from collections import defaultdict
from threading import Lock
from typing import Dict, List

class EventBus:
    """Thread-safe pub/sub: sync routes publish, async SSE endpoint subscribes."""

    def __init__(self):
        self._subscribers: Dict[int, List[asyncio.Queue]] = defaultdict(list)
        self._lock = Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, user_id: int, q: asyncio.Queue) -> None:
        with self._lock:
            self._subscribers[user_id].append(q)

    def unsubscribe(self, user_id: int, q: asyncio.Queue) -> None:
        with self._lock:
            try:
                self._subscribers[user_id].remove(q)
            except ValueError:
                pass

    def publish(self, user_id: int, event: dict) -> None:
        if not self._loop:
            return
        with self._lock:
            queues = list(self._subscribers.get(user_id, []))
        for q in queues:
            # Safe to call from sync threads
            self._loop.call_soon_threadsafe(q.put_nowait, event)


event_bus = EventBus()
