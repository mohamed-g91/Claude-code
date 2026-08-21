"""SQLite-backed storage for UsageRecord rows."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .models import UsageRecord

DEFAULT_DB_PATH = Path(
    os.environ.get("TOKEN_TRACKER_DB", str(Path(__file__).resolve().parent.parent / "data" / "usage.db"))
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    request_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
    thinking_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_5m_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_1h_tokens INTEGER NOT NULL DEFAULT 0,
    web_search_requests INTEGER NOT NULL DEFAULT 0,
    web_fetch_requests INTEGER NOT NULL DEFAULT 0,
    service_tier TEXT,
    speed TEXT,
    inference_geo TEXT,
    effort TEXT,
    project TEXT,
    cost_usd REAL,
    raw_usage_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(source, request_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_session ON usage(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_model ON usage(model);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
"""

_COLUMNS = [
    "source",
    "request_id",
    "session_id",
    "timestamp",
    "model",
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "thinking_tokens",
    "cache_creation_5m_tokens",
    "cache_creation_1h_tokens",
    "web_search_requests",
    "web_fetch_requests",
    "service_tier",
    "speed",
    "inference_geo",
    "effort",
    "project",
    "cost_usd",
    "raw_usage_json",
]


class UsageStore:
    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "UsageStore":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def upsert(self, record: UsageRecord) -> None:
        self.upsert_many([record])

    def upsert_many(self, records: list[UsageRecord]) -> int:
        if not records:
            return 0
        placeholders = ", ".join(f":{c}" for c in _COLUMNS)
        column_list = ", ".join(_COLUMNS)
        update_clause = ", ".join(f"{c}=excluded.{c}" for c in _COLUMNS if c not in ("source", "request_id"))
        sql = f"""
            INSERT INTO usage ({column_list}) VALUES ({placeholders})
            ON CONFLICT(source, request_id) DO UPDATE SET {update_clause}
        """
        rows = [record.to_row() for record in records]
        with self._conn:
            self._conn.executemany(sql, rows)
        return len(rows)

    @contextmanager
    def cursor(self):
        cur = self._conn.cursor()
        try:
            yield cur
        finally:
            cur.close()

    def all_records(
        self,
        *,
        since: str | None = None,
        until: str | None = None,
        source: str | None = None,
        model: str | None = None,
        session_id: str | None = None,
    ) -> list[UsageRecord]:
        clauses = []
        params: dict = {}
        if since:
            clauses.append("timestamp >= :since")
            params["since"] = since
        if until:
            clauses.append("timestamp <= :until")
            params["until"] = until
        if source:
            clauses.append("source = :source")
            params["source"] = source
        if model:
            clauses.append("model = :model")
            params["model"] = model
        if session_id:
            clauses.append("session_id = :session_id")
            params["session_id"] = session_id
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT * FROM usage {where} ORDER BY timestamp ASC"
        with self.cursor() as cur:
            cur.execute(sql, params)
            return [UsageRecord.from_row(dict(row)) for row in cur.fetchall()]

    def count(self) -> int:
        with self.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM usage")
            return cur.fetchone()["n"]
