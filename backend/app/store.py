"""OpenSearch-backed document store.

Documents are stored as an opaque `data` blob with indexing disabled. The
original Firestore documents contain dynamic keys (portfolio maps keyed by
stock symbol) and large OHLC arrays, both of which would cause a mapping
explosion if OpenSearch tried to index them field by field.
"""

import time
from typing import Any

from opensearchpy import NotFoundError, OpenSearch

from .config import COLLECTIONS, index_for, settings

INDEX_BODY: dict[str, Any] = {
    "settings": {"index": {"number_of_shards": 1, "number_of_replicas": 0}},
    "mappings": {
        "dynamic": "strict",
        "properties": {
            "id": {"type": "keyword"},
            "updatedAt": {"type": "date", "format": "epoch_millis"},
            "data": {"type": "object", "enabled": False},
        },
    },
}


def _make_client() -> OpenSearch:
    kwargs: dict[str, Any] = {
        "hosts": [settings.opensearch_host],
        "verify_certs": settings.opensearch_verify_certs,
        "ssl_show_warn": False,
        "timeout": 30,
        "retry_on_timeout": True,
        "max_retries": 3,
        # The frontend polls several collections in parallel; the default pool
        # size of 1 causes connections to be discarded and reopened constantly.
        "maxsize": 20,
    }
    if settings.opensearch_user:
        kwargs["http_auth"] = (settings.opensearch_user, settings.opensearch_password)
    return OpenSearch(**kwargs)


client = _make_client()


def ensure_indices() -> None:
    for collection in COLLECTIONS:
        index = index_for(collection)
        if not client.indices.exists(index=index):
            client.indices.create(index=index, body=INDEX_BODY)


def _check(collection: str) -> str:
    if collection not in COLLECTIONS:
        raise ValueError(f"unknown collection: {collection}")
    return index_for(collection)


def get_doc(collection: str, doc_id: str) -> dict[str, Any] | None:
    index = _check(collection)
    try:
        res = client.get(index=index, id=doc_id)
    except NotFoundError:
        return None
    return res["_source"].get("data") or {}


def list_docs(collection: str) -> list[dict[str, Any]]:
    index = _check(collection)
    docs: list[dict[str, Any]] = []
    res = client.search(
        index=index,
        body={"query": {"match_all": {}}, "size": 1000, "_source": ["id", "data"]},
    )
    for hit in res["hits"]["hits"]:
        data = hit["_source"].get("data") or {}
        docs.append({**data, "id": hit["_source"].get("id", hit["_id"])})
    return docs


def set_doc(
    collection: str, doc_id: str, data: dict[str, Any], merge: bool = False
) -> dict[str, Any]:
    index = _check(collection)
    payload = dict(data)
    if merge:
        existing = get_doc(collection, doc_id) or {}
        payload = {**existing, **payload}
    payload["id"] = doc_id
    client.index(
        index=index,
        id=doc_id,
        body={"id": doc_id, "updatedAt": int(time.time() * 1000), "data": payload},
        refresh="wait_for",
    )
    return payload


def delete_doc(collection: str, doc_id: str) -> bool:
    index = _check(collection)
    try:
        client.delete(index=index, id=doc_id, refresh="wait_for")
    except NotFoundError:
        return False
    return True


def commit_batch(operations: list[dict[str, Any]]) -> int:
    """Apply a list of {op, collection, id, data, merge} operations."""
    applied = 0
    for op in operations:
        kind = op.get("op", "set")
        collection = op["collection"]
        doc_id = op["id"]
        if kind == "delete":
            delete_doc(collection, doc_id)
        else:
            set_doc(collection, doc_id, op.get("data") or {}, bool(op.get("merge")))
        applied += 1
    return applied
