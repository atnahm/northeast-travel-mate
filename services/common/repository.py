from __future__ import annotations

import json
import os
import threading
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from google.cloud.firestore_v1.base_query import FieldFilter

from services.common.config import get_settings
from services.common.firebase_client import get_firestore_client, get_resolved_mode

MAX_FIRESTORE_BATCH = 450


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _normalize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_value(v) for v in value]
    return value


def _matches_filter(doc: Dict[str, Any], field: str, op: str, target: Any) -> bool:
    parts = field.split(".")
    cur: Any = doc
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            cur = None
            break

    if op == "==":
        return cur == target
    if op == "!=":
        return cur != target
    if op == "<":
        return cur is not None and cur < target
    if op == "<=":
        return cur is not None and cur <= target
    if op == ">":
        return cur is not None and cur > target
    if op == ">=":
        return cur is not None and cur >= target
    if op == "in":
        return cur in (target or [])
    if op == "not-in":
        return cur not in (target or [])
    if op == "array-contains":
        return isinstance(cur, list) and target in cur
    if op == "array-contains-any":
        return isinstance(cur, list) and any(item in cur for item in (target or []))
    raise ValueError(f"Unsupported filter operator: {op}")


class BaseNoSQLRepo(ABC):
    @abstractmethod
    def get_doc(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def set_doc(self, collection: str, doc_id: str, data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        ...

    @abstractmethod
    def update_doc(self, collection: str, doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def delete_doc(self, collection: str, doc_id: str) -> bool:
        ...

    @abstractmethod
    def list_docs(
        self,
        collection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def query_docs(
        self,
        collection: str,
        filters: Optional[List[Tuple[str, str, Any]]] = None,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def batch_set(self, collection: str, docs: Iterable[Tuple[str, Dict[str, Any]]]) -> int:
        ...

    # --- Subcollection operations ---
    @abstractmethod
    def get_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def set_subdoc(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        subdoc_id: str,
        data: Dict[str, Any],
        merge: bool = False,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    def delete_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> bool:
        ...

    @abstractmethod
    def list_subdocs(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
    ) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def clear_subcollection(self, collection: str, doc_id: str, subcollection: str) -> int:
        ...


class FirestoreRepo(BaseNoSQLRepo):
    """Production Cloud Firestore (and Emulator) NoSQL repository."""

    def __init__(self, client: Any) -> None:
        self._db = client

    def _enrich(self, doc_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        norm = _normalize_value(data)
        norm.setdefault("id", doc_id)
        return norm

    def get_doc(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        snap = self._db.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        return self._enrich(snap.id, snap.to_dict() or {})

    def set_doc(self, collection: str, doc_id: str, data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        payload = dict(data)
        payload.setdefault("id", doc_id)
        now = utc_now_iso()
        payload.setdefault("created_at", now)
        payload["updated_at"] = now
        self._db.collection(collection).document(doc_id).set(payload, merge=merge)
        return self.get_doc(collection, doc_id) or payload

    def update_doc(self, collection: str, doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ref = self._db.collection(collection).document(doc_id)
        snap = ref.get()
        if not snap.exists:
            return None
        payload = dict(updates)
        payload["updated_at"] = utc_now_iso()
        ref.update(payload)
        return self.get_doc(collection, doc_id)

    def delete_doc(self, collection: str, doc_id: str) -> bool:
        ref = self._db.collection(collection).document(doc_id)
        if not ref.get().exists:
            return False
        ref.delete()
        return True

    def list_docs(
        self,
        collection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        return self.query_docs(collection, filters=None, order_by=order_by, descending=descending, limit=limit)

    def query_docs(
        self,
        collection: str,
        filters: Optional[List[Tuple[str, str, Any]]] = None,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query: Any = self._db.collection(collection)
        if filters:
            for field, op, val in filters:
                query = query.where(filter=FieldFilter(field, op, val))
        if order_by:
            from google.cloud.firestore_v1 import Query as FsQuery

            direction = FsQuery.DESCENDING if descending else FsQuery.ASCENDING
            query = query.order_by(order_by, direction=direction)
        if limit:
            query = query.limit(limit)
        return [self._enrich(snap.id, snap.to_dict() or {}) for snap in query.stream()]

    def batch_set(self, collection: str, docs: Iterable[Tuple[str, Dict[str, Any]]]) -> int:
        count = 0
        batch = self._db.batch()
        in_batch = 0
        now = utc_now_iso()
        col_ref = self._db.collection(collection)
        for doc_id, data in docs:
            payload = dict(data)
            payload.setdefault("id", doc_id)
            payload.setdefault("created_at", now)
            payload["updated_at"] = now
            batch.set(col_ref.document(doc_id), payload)
            count += 1
            in_batch += 1
            if in_batch >= MAX_FIRESTORE_BATCH:
                batch.commit()
                batch = self._db.batch()
                in_batch = 0
        if in_batch > 0:
            batch.commit()
        return count

    def get_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> Optional[Dict[str, Any]]:
        snap = self._db.collection(collection).document(doc_id).collection(subcollection).document(subdoc_id).get()
        if not snap.exists:
            return None
        return self._enrich(snap.id, snap.to_dict() or {})

    def set_subdoc(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        subdoc_id: str,
        data: Dict[str, Any],
        merge: bool = False,
    ) -> Dict[str, Any]:
        payload = dict(data)
        payload.setdefault("id", subdoc_id)
        now = utc_now_iso()
        payload.setdefault("created_at", now)
        payload["updated_at"] = now
        ref = self._db.collection(collection).document(doc_id).collection(subcollection).document(subdoc_id)
        ref.set(payload, merge=merge)
        return self.get_subdoc(collection, doc_id, subcollection, subdoc_id) or payload

    def delete_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> bool:
        ref = self._db.collection(collection).document(doc_id).collection(subcollection).document(subdoc_id)
        if not ref.get().exists:
            return False
        ref.delete()
        return True

    def list_subdocs(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
    ) -> List[Dict[str, Any]]:
        query: Any = self._db.collection(collection).document(doc_id).collection(subcollection)
        if order_by:
            from google.cloud.firestore_v1 import Query as FsQuery

            direction = FsQuery.DESCENDING if descending else FsQuery.ASCENDING
            query = query.order_by(order_by, direction=direction)
        return [self._enrich(snap.id, snap.to_dict() or {}) for snap in query.stream()]

    def clear_subcollection(self, collection: str, doc_id: str, subcollection: str) -> int:
        col_ref = self._db.collection(collection).document(doc_id).collection(subcollection)
        snaps = list(col_ref.stream())
        if not snaps:
            return 0
        count = 0
        batch = self._db.batch()
        in_batch = 0
        for snap in snaps:
            batch.delete(snap.reference)
            count += 1
            in_batch += 1
            if in_batch >= MAX_FIRESTORE_BATCH:
                batch.commit()
                batch = self._db.batch()
                in_batch = 0
        if in_batch > 0:
            batch.commit()
        return count


class LocalNoSQLRepo(BaseNoSQLRepo):
    """Thread-safe file-persisted Firestore-compatible NoSQL fallback store."""

    def __init__(self, base_dir: Path) -> None:
        self._dir = base_dir
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def _file_for(self, key: str) -> Path:
        safe = key.replace("/", "__").replace("\\", "__")
        return self._dir / f"{safe}.json"

    def _read_map(self, key: str) -> Dict[str, Dict[str, Any]]:
        path = self._file_for(key)
        if not path.exists():
            return {}
        try:
            with path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
                return raw if isinstance(raw, dict) else {}
        except json.JSONDecodeError:
            return {}

    def _write_map(self, key: str, data: Dict[str, Dict[str, Any]]) -> None:
        path = self._file_for(key)
        tmp = path.with_suffix(f".{uuid.uuid4().hex[:8]}.tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def get_doc(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            store = self._read_map(collection)
            doc = store.get(doc_id)
            return dict(doc) if doc is not None else None

    def set_doc(self, collection: str, doc_id: str, data: Dict[str, Any], merge: bool = False) -> Dict[str, Any]:
        with self._lock:
            store = self._read_map(collection)
            now = utc_now_iso()
            existing = store.get(doc_id, {}) if merge else {}
            merged = {**existing, **data}
            merged.setdefault("id", doc_id)
            merged.setdefault("created_at", existing.get("created_at") or now)
            merged["updated_at"] = now
            store[doc_id] = merged
            self._write_map(collection, store)
            return dict(merged)

    def update_doc(self, collection: str, doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            store = self._read_map(collection)
            if doc_id not in store:
                return None
            doc = dict(store[doc_id])
            doc.update(updates)
            doc["updated_at"] = utc_now_iso()
            store[doc_id] = doc
            self._write_map(collection, store)
            return dict(doc)

    def delete_doc(self, collection: str, doc_id: str) -> bool:
        with self._lock:
            store = self._read_map(collection)
            if doc_id not in store:
                return False
            del store[doc_id]
            self._write_map(collection, store)
            return True

    def list_docs(
        self,
        collection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        return self.query_docs(collection, filters=None, order_by=order_by, descending=descending, limit=limit)

    def query_docs(
        self,
        collection: str,
        filters: Optional[List[Tuple[str, str, Any]]] = None,
        order_by: Optional[str] = None,
        descending: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            docs = [dict(v) for v in self._read_map(collection).values()]
        if filters:
            docs = [d for d in docs if all(_matches_filter(d, f, op, val) for f, op, val in filters)]
        if order_by:
            docs.sort(
                key=lambda d: (
                    d.get(order_by) is None,
                    "" if d.get(order_by) is None else str(d.get(order_by)) if isinstance(d.get(order_by), bool) else d.get(order_by),
                ),
                reverse=descending,
            )
        if limit is not None:
            docs = docs[:limit]
        return docs

    def batch_set(self, collection: str, docs: Iterable[Tuple[str, Dict[str, Any]]]) -> int:
        with self._lock:
            store = self._read_map(collection)
            now = utc_now_iso()
            count = 0
            for doc_id, data in docs:
                payload = dict(data)
                payload.setdefault("id", doc_id)
                payload.setdefault("created_at", now)
                payload["updated_at"] = now
                store[doc_id] = payload
                count += 1
            self._write_map(collection, store)
            return count

    def _sub_key(self, collection: str, doc_id: str, subcollection: str) -> str:
        return f"{collection}__{doc_id}__{subcollection}"

    def get_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> Optional[Dict[str, Any]]:
        return self.get_doc(self._sub_key(collection, doc_id, subcollection), subdoc_id)

    def set_subdoc(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        subdoc_id: str,
        data: Dict[str, Any],
        merge: bool = False,
    ) -> Dict[str, Any]:
        return self.set_doc(self._sub_key(collection, doc_id, subcollection), subdoc_id, data, merge=merge)

    def delete_subdoc(self, collection: str, doc_id: str, subcollection: str, subdoc_id: str) -> bool:
        return self.delete_doc(self._sub_key(collection, doc_id, subcollection), subdoc_id)

    def list_subdocs(
        self,
        collection: str,
        doc_id: str,
        subcollection: str,
        order_by: Optional[str] = None,
        descending: bool = False,
    ) -> List[Dict[str, Any]]:
        return self.list_docs(self._sub_key(collection, doc_id, subcollection), order_by=order_by, descending=descending)

    def clear_subcollection(self, collection: str, doc_id: str, subcollection: str) -> int:
        with self._lock:
            key = self._sub_key(collection, doc_id, subcollection)
            existing = self._read_map(key)
            count = len(existing)
            if count:
                self._write_map(key, {})
            return count


_repo_lock = threading.Lock()
_repo_instance: Optional[BaseNoSQLRepo] = None


def get_repo(force_local: bool = False) -> BaseNoSQLRepo:
    global _repo_instance
    if force_local:
        return LocalNoSQLRepo(get_settings().local_db_dir)

    if _repo_instance is not None:
        return _repo_instance

    with _repo_lock:
        if _repo_instance is not None:
            return _repo_instance
        mode = get_resolved_mode()
        if mode in ("firestore", "emulator"):
            client = get_firestore_client()
            _repo_instance = FirestoreRepo(client)
        else:
            _repo_instance = LocalNoSQLRepo(get_settings().local_db_dir)
        return _repo_instance


def reset_repo_for_tests() -> None:
    global _repo_instance
    with _repo_lock:
        _repo_instance = None
