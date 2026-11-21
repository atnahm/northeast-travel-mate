from __future__ import annotations

import json
import threading
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Optional, Tuple

import redis

from services.common.config import get_settings


class CacheClient:
    """Redis-backed cache & sliding-window rate limiter with automatic in-memory fallback."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._memory: Dict[str, Tuple[float, Any]] = {}
        self._rate_buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._redis: Optional[redis.Redis] = None
        self._redis_checked = False

    def _get_redis(self) -> Optional[redis.Redis]:
        if self._redis_checked:
            return self._redis
        with self._lock:
            if self._redis_checked:
                return self._redis
            settings = get_settings()
            if settings.redis_url:
                try:
                    client = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.5)
                    client.ping()
                    self._redis = client
                except Exception:
                    self._redis = None
            self._redis_checked = True
            return self._redis

    def ping(self) -> bool:
        r = self._get_redis()
        if not r:
            return False
        try:
            return bool(r.ping())
        except Exception:
            return False

    def get_json(self, key: str) -> Optional[Any]:
        r = self._get_redis()
        if r:
            try:
                raw = r.get(key)
                return json.loads(raw) if raw else None
            except Exception:
                pass
        with self._lock:
            entry = self._memory.get(key)
            if not entry:
                return None
            expires_at, val = entry
            if time.time() > expires_at:
                del self._memory[key]
                return None
            return val

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        r = self._get_redis()
        if r:
            try:
                r.setex(key, ttl_seconds, json.dumps(value, ensure_ascii=False))
                return
            except Exception:
                pass
        with self._lock:
            self._memory[key] = (time.time() + ttl_seconds, value)

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
        """Returns (allowed, remaining)."""
        r = self._get_redis()
        if r:
            try:
                pipe = r.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds, nx=True)
                count, _ = pipe.execute()
                remaining = max(0, max_requests - int(count))
                return int(count) <= max_requests, remaining
            except Exception:
                pass

        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            dq = self._rate_buckets[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= max_requests:
                return False, 0
            dq.append(now)
            return True, max(0, max_requests - len(dq))


_cache = CacheClient()


def get_cache() -> CacheClient:
    return _cache
