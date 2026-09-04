"""PostgreSQL document store for Supabase's transaction pooler."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..config import COLLECTIONS


class PostgresStore:
    """A connection-per-operation store suitable for serverless processes.

    Supabase's transaction pooler already pools connections. Keeping another
    long-lived application pool wastes serverless connections and can retain
    stale sockets. Disabling prepared statements is required for transaction
    pooler compatibility.
    """

    def __init__(self, database_url: str):
        self.database_url = database_url

    @contextmanager
    def _connect(self) -> Iterator[Connection]:
        if not self.database_url:
            raise RuntimeError(
                "DATABASE_URL is required for STORE_BACKEND=postgres"
            )
        with psycopg.connect(
            self.database_url,
            prepare_threshold=None,
            row_factory=dict_row,
        ) as connection:
            yield connection

    @staticmethod
    def _check(collection: str) -> None:
        if collection not in COLLECTIONS:
            raise ValueError(f"unknown collection: {collection}")

    def ensure_ready(self) -> None:
        # Schema changes are deliberately migration-driven. This only verifies
        # that the configured database and migrated table are available.
        with self._connect() as connection:
            connection.execute("SELECT 1 FROM public.documents LIMIT 0")

    def health(self) -> dict[str, Any]:
        try:
            with self._connect() as connection:
                connection.execute("SELECT 1").fetchone()
            return {"ok": True, "backend": "postgres"}
        except Exception:  # noqa: BLE001 - health output must not leak credentials
            return {"ok": False, "backend": "postgres"}

    def get_doc(
        self, collection: str, doc_id: str, user_id: str
    ) -> dict[str, Any] | None:
        self._check(collection)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT data
                FROM public.documents
                WHERE user_id = %s AND collection = %s AND id = %s
                """,
                (user_id, collection, doc_id),
            ).fetchone()
        return dict(row["data"]) if row else None

    def list_docs(self, collection: str, user_id: str) -> list[dict[str, Any]]:
        self._check(collection)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, data
                FROM public.documents
                WHERE user_id = %s AND collection = %s
                ORDER BY updated_at, id
                """,
                (user_id, collection),
            ).fetchall()
        return [{**dict(row["data"]), "id": row["id"]} for row in rows]

    def set_doc(
        self,
        collection: str,
        doc_id: str,
        data: dict[str, Any],
        merge: bool,
        user_id: str,
        *,
        connection: Connection | None = None,
    ) -> dict[str, Any]:
        self._check(collection)
        payload = {**data, "id": doc_id}
        sql = """
            INSERT INTO public.documents (user_id, collection, id, data)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, collection, id) DO UPDATE
            SET data = {data_expression}, updated_at = now()
            RETURNING data
        """.format(
            data_expression=(
                "public.documents.data || EXCLUDED.data" if merge else "EXCLUDED.data"
            )
        )
        params = (user_id, collection, doc_id, Jsonb(payload))
        if connection is not None:
            row = connection.execute(sql, params).fetchone()
            return dict(row["data"])
        with self._connect() as own_connection:
            row = own_connection.execute(sql, params).fetchone()
        return dict(row["data"])

    def delete_doc(
        self,
        collection: str,
        doc_id: str,
        user_id: str,
        *,
        connection: Connection | None = None,
    ) -> bool:
        self._check(collection)
        sql = """
            DELETE FROM public.documents
            WHERE user_id = %s AND collection = %s AND id = %s
        """
        params = (user_id, collection, doc_id)
        if connection is not None:
            return connection.execute(sql, params).rowcount > 0
        with self._connect() as own_connection:
            return own_connection.execute(sql, params).rowcount > 0

    def commit_batch(
        self, operations: list[dict[str, Any]], user_id: str
    ) -> int:
        # One psycopg connection context is one transaction. Any failure rolls
        # back every operation, with no artificial operation-count limit.
        with self._connect() as connection:
            for operation in operations:
                kind = operation.get("op", "set")
                collection = operation["collection"]
                doc_id = operation["id"]
                if kind == "delete":
                    self.delete_doc(
                        collection, doc_id, user_id, connection=connection
                    )
                elif kind == "set":
                    self.set_doc(
                        collection,
                        doc_id,
                        operation.get("data") or {},
                        bool(operation.get("merge")),
                        user_id,
                        connection=connection,
                    )
                else:
                    raise ValueError(f"unknown batch operation: {kind}")
        return len(operations)
