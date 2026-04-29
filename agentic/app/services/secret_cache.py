"""In-process TTL cache for Vault secrets (Task 1.5).

The acceptance criteria for Task 1.5 require >90% reduction in Vault QPS
for repeated reads of the same secret. We achieve that with a small
async-safe TTL cache keyed by ``(user_id, secret_type)``.

* Entries expire after ``settings.vault_cache_ttl_s`` seconds.
* Negative results are **not** cached so a freshly-stored secret becomes
  visible immediately.
* The cache is owned by ``app.state`` so it lives for the broker's
  lifetime and is shared across requests.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from app.clients.vault import SecretValue, VaultClient
from app.config import Settings
from app.models.secret import SecretType


log = logging.getLogger("agentic.secret_cache")


@dataclass
class _CacheEntry:
    value: SecretValue
    fetched_at: float


class SecretCache:
    """Async-safe TTL cache around :class:`VaultClient.get_user_secret`."""

    def __init__(self, settings: Settings, client: VaultClient) -> None:
        self._settings = settings
        self._client = client
        self._entries: Dict[Tuple[str, SecretType], _CacheEntry] = {}
        # Per-key locks so concurrent callers waiting for the same secret
        # collapse to a single Vault read instead of stampeding.
        self._key_locks: Dict[Tuple[str, SecretType], asyncio.Lock] = {}
        self._registry_lock = asyncio.Lock()
        self.hits = 0
        self.misses = 0

    async def get(
        self,
        *,
        user_id: str,
        secret_type: SecretType,
    ) -> SecretValue:
        key = (user_id, secret_type)

        cached = self._fresh(key)
        if cached is not None:
            self.hits += 1
            return cached

        async with await self._lock_for(key):
            # Double-check after acquiring the lock — another coroutine
            # may have populated the cache while we were waiting.
            cached = self._fresh(key)
            if cached is not None:
                self.hits += 1
                return cached

            self.misses += 1
            value = await self._client.get_user_secret(
                user_id=user_id, secret_type=secret_type
            )
            self._entries[key] = _CacheEntry(
                value=value, fetched_at=time.monotonic()
            )
            log.info(
                "secret_cache_store",
                extra={
                    "user_id": user_id,
                    "secret_type": secret_type.value,
                    "expires_at": value.expires_at,
                },
            )
            return value

    def invalidate(self, *, user_id: str, secret_type: SecretType) -> None:
        self._entries.pop((user_id, secret_type), None)

    def clear(self) -> None:
        self._entries.clear()

    # --------------------------------------------------------------- internals
    def _fresh(
        self, key: Tuple[str, SecretType]
    ) -> Optional[SecretValue]:
        entry = self._entries.get(key)
        if entry is None:
            return None
        ttl = self._settings.vault_cache_ttl_s
        if ttl <= 0:
            return None
        if (time.monotonic() - entry.fetched_at) > ttl:
            self._entries.pop(key, None)
            return None
        return entry.value

    async def _lock_for(self, key: Tuple[str, SecretType]) -> asyncio.Lock:
        async with self._registry_lock:
            lock = self._key_locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._key_locks[key] = lock
            return lock
