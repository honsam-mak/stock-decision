"""Backend-neutral document-store facade.

The module-level functions are intentionally kept compatible with the original
OpenSearch implementation. ``user_id`` is optional for local callers and is
always supplied explicitly by authenticated API routes.
"""

import hashlib
import time
from typing import Any

from opensearchpy import NotFoundError, OpenSearch, helpers

from .config import COLLECTIONS, index_for, settings
from .stores.postgres import PostgresStore

INDEX_BODY: dict[str, Any] = {
    "settings": {"index": {"number_of_shards": 1, "number_of_replicas": 0}},
    "mappings": {
        "dynamic": "strict",
        "properties": {
            "id": {"type": "keyword"},
            "userId": {"type": "keyword"},
            "updatedAt": {"type": "date", "format": "epoch_millis"},
            "data": {"type": "object", "enabled": False},
        },
    },
}


class OpenSearchStore:
    def __init__(self) -> None:
        kwargs: dict[str, Any] = {
            "hosts": [settings.opensearch_host],
            "verify_certs": settings.opensearch_verify_certs,
            "ssl_show_warn": False,
            "timeout": 30,
            "retry_on_timeout": True,
            "max_retries": 3,
            "maxsize": 20,
        }
        if settings.opensearch_user:
            kwargs["http_auth"] = (
                settings.opensearch_user,
                settings.opensearch_password,
            )
        self.client = OpenSearch(**kwargs)

    @staticmethod
    def _check(collection: str) -> str:
        if collection not in COLLECTIONS:
            raise ValueError(f"unknown collection: {collection}")
        return index_for(collection)

    @staticmethod
    def _storage_id(doc_id: str, user_id: str) -> str:
        # Preserve existing local OpenSearch document IDs. Non-local IDs are
        # namespaced with a one-way fixed-length prefix.
        if user_id == settings.local_user_id:
            return doc_id
        prefix = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
        return f"{prefix}:{doc_id}"

    def ensure_ready(self) -> None:
        for collection in COLLECTIONS:
            index = index_for(collection)
            if not self.client.indices.exists(index=index):
                self.client.indices.create(index=index, body=INDEX_BODY)
            else:
                self.client.indices.put_mapping(
                    index=index,
                    body={"properties": {"userId": {"type": "keyword"}}},
                )

    def health(self) -> dict[str, Any]:
        try:
            info = self.client.info()
            return {
                "ok": True,
                "backend": "opensearch",
                "version": info.get("version", {}).get("number", "unknown"),
            }
        except Exception:  # noqa: BLE001 - do not expose hosts or credentials
            return {"ok": False, "backend": "opensearch"}

    def get_doc(
        self, collection: str, doc_id: str, user_id: str
    ) -> dict[str, Any] | None:
        index = self._check(collection)
        try:
            result = self.client.get(
                index=index, id=self._storage_id(doc_id, user_id)
            )
        except NotFoundError:
            return None
        source = result["_source"]
        owner = source.get("userId")
        if owner is not None and owner != user_id:
            return None
        if owner is None and user_id != settings.local_user_id:
            return None
        return source.get("data") or {}

    def list_docs(self, collection: str, user_id: str) -> list[dict[str, Any]]:
        index = self._check(collection)
        if user_id == settings.local_user_id:
            query = {
                "bool": {
                    "should": [
                        {"term": {"userId": user_id}},
                        {"bool": {"must_not": {"exists": {"field": "userId"}}}},
                    ],
                    "minimum_should_match": 1,
                }
            }
        else:
            query = {"term": {"userId": user_id}}
        hits = helpers.scan(
            self.client,
            index=index,
            query={"query": query, "_source": ["id", "data"]},
            preserve_order=False,
        )
        return [
            {
                **(hit["_source"].get("data") or {}),
                "id": hit["_source"].get("id", hit["_id"]),
            }
            for hit in hits
        ]

    def set_doc(
        self,
        collection: str,
        doc_id: str,
        data: dict[str, Any],
        merge: bool,
        user_id: str,
    ) -> dict[str, Any]:
        index = self._check(collection)
        payload = dict(data)
        if merge:
            payload = {**(self.get_doc(collection, doc_id, user_id) or {}), **payload}
        payload["id"] = doc_id
        self.client.index(
            index=index,
            id=self._storage_id(doc_id, user_id),
            body={
                "id": doc_id,
                "userId": user_id,
                "updatedAt": int(time.time() * 1000),
                "data": payload,
            },
            refresh="wait_for",
        )
        return payload

    def delete_doc(self, collection: str, doc_id: str, user_id: str) -> bool:
        index = self._check(collection)
        # Verify ownership before deleting legacy/raw local IDs.
        if self.get_doc(collection, doc_id, user_id) is None:
            return False
        try:
            self.client.delete(
                index=index,
                id=self._storage_id(doc_id, user_id),
                refresh="wait_for",
            )
        except NotFoundError:
            return False
        return True

    def commit_batch(
        self, operations: list[dict[str, Any]], user_id: str
    ) -> int:
        for operation in operations:
            kind = operation.get("op", "set")
            if kind == "delete":
                self.delete_doc(
                    operation["collection"], operation["id"], user_id
                )
            elif kind == "set":
                self.set_doc(
                    operation["collection"],
                    operation["id"],
                    operation.get("data") or {},
                    bool(operation.get("merge")),
                    user_id,
                )
            else:
                raise ValueError(f"unknown batch operation: {kind}")
        return len(operations)


def _make_backend() -> OpenSearchStore | PostgresStore:
    backend = settings.store_backend.strip().lower()
    if backend == "opensearch":
        return OpenSearchStore()
    if backend == "postgres":
        return PostgresStore(settings.database_url)
    raise ValueError(f"unsupported STORE_BACKEND: {settings.store_backend}")


_backend = _make_backend()
# Kept for callers that used the OpenSearch client directly.
client = getattr(_backend, "client", None)


def _user(user_id: str | None) -> str:
    return user_id or settings.local_user_id


def ensure_indices() -> None:
    """Prepare or verify the selected backend (legacy function name)."""
    _backend.ensure_ready()


def health() -> dict[str, Any]:
    return _backend.health()


def get_doc(
    collection: str, doc_id: str, user_id: str | None = None
) -> dict[str, Any] | None:
    return _backend.get_doc(collection, doc_id, _user(user_id))


def list_docs(
    collection: str, user_id: str | None = None
) -> list[dict[str, Any]]:
    return _backend.list_docs(collection, _user(user_id))


def set_doc(
    collection: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
    user_id: str | None = None,
) -> dict[str, Any]:
    return _backend.set_doc(collection, doc_id, data, merge, _user(user_id))


def delete_doc(
    collection: str, doc_id: str, user_id: str | None = None
) -> bool:
    return _backend.delete_doc(collection, doc_id, _user(user_id))


def commit_batch(
    operations: list[dict[str, Any]], user_id: str | None = None
) -> int:
    """Apply {op, collection, id, data, merge} operations for one user."""
    return _backend.commit_batch(operations, _user(user_id))
