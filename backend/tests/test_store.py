from typing import Any

from app import store
from app.stores.postgres import PostgresStore


class MemoryBackend:
    def __init__(self):
        self.documents: dict[tuple[str, str, str], dict[str, Any]] = {}

    def set_doc(self, collection, doc_id, data, merge, user_id):
        key = (user_id, collection, doc_id)
        existing = self.documents.get(key, {}) if merge else {}
        result = {**existing, **data, "id": doc_id}
        self.documents[key] = result
        return result

    def get_doc(self, collection, doc_id, user_id):
        return self.documents.get((user_id, collection, doc_id))

    def list_docs(self, collection, user_id):
        return [
            value
            for (owner, item_collection, _), value in self.documents.items()
            if owner == user_id and item_collection == collection
        ]

    def delete_doc(self, collection, doc_id, user_id):
        return self.documents.pop((user_id, collection, doc_id), None) is not None

    def commit_batch(self, operations, user_id):
        for operation in operations:
            if operation.get("op", "set") == "delete":
                self.delete_doc(operation["collection"], operation["id"], user_id)
            else:
                self.set_doc(
                    operation["collection"],
                    operation["id"],
                    operation.get("data") or {},
                    operation.get("merge", False),
                    user_id,
                )
        return len(operations)


def test_facade_partitions_users_and_keeps_local_default(monkeypatch):
    backend = MemoryBackend()
    monkeypatch.setattr(store, "_backend", backend)
    monkeypatch.setattr(store.settings, "local_user_id", "local-user")

    store.set_doc("stocks", "same-id", {"value": 1})
    store.set_doc("stocks", "same-id", {"value": 2}, user_id="remote-user")

    assert store.get_doc("stocks", "same-id")["value"] == 1
    assert store.get_doc("stocks", "same-id", "remote-user")["value"] == 2
    assert len(store.list_docs("stocks", "remote-user")) == 1


class FakeResult:
    rowcount = 1

    def fetchone(self):
        return {"data": {"id": "doc"}}


class FakeConnection:
    def __init__(self):
        self.execute_count = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, _sql, _params=None):
        self.execute_count += 1
        return FakeResult()


def test_postgres_batch_uses_one_transaction_without_limit(monkeypatch):
    connections: list[FakeConnection] = []
    connect_kwargs: list[dict[str, Any]] = []

    def fake_connect(_url, **kwargs):
        connection = FakeConnection()
        connections.append(connection)
        connect_kwargs.append(kwargs)
        return connection

    monkeypatch.setattr("app.stores.postgres.psycopg.connect", fake_connect)
    backend = PostgresStore("postgresql://example.invalid/database")
    operations = [
        {"op": "set", "collection": "stocks", "id": str(index), "data": {}}
        for index in range(1001)
    ]

    assert backend.commit_batch(operations, "owner") == 1001
    assert len(connections) == 1
    assert connections[0].execute_count == 1001
    assert connect_kwargs[0]["prepare_threshold"] is None
