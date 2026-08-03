from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Iterator

from .contracts import CrawlItem, ItemKind, ItemStatus, utc_now


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS crawl_items (
    item_id INTEGER PRIMARY KEY,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    kind TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    parent_url TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    analysis_eligible INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    error TEXT,
    content_hash TEXT,
    local_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source_id, url)
);

CREATE INDEX IF NOT EXISTS crawl_items_queue
ON crawl_items(status, next_attempt_at, item_id);

CREATE TABLE IF NOT EXISTS analyses (
    analysis_id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES crawl_items(item_id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    task TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(item_id, profile_id, model_id, task)
);

CREATE TABLE IF NOT EXISTS audit_events (
    event_id INTEGER PRIMARY KEY,
    event_type TEXT NOT NULL,
    source_id TEXT,
    item_id INTEGER,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


class CrawlState:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.connection = sqlite3.connect(path)
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript(SCHEMA)
        columns = {
            row["name"]
            for row in self.connection.execute("PRAGMA table_info(crawl_items)")
        }
        if "analysis_eligible" not in columns:
            with self.connection:
                self.connection.execute(
                    "ALTER TABLE crawl_items "
                    "ADD COLUMN analysis_eligible INTEGER NOT NULL DEFAULT 1"
                )

    def close(self) -> None:
        self.connection.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self.connection:
            yield self.connection

    def enqueue(
        self,
        *,
        source_id: str,
        url: str,
        kind: ItemKind,
        depth: int,
        parent_url: str | None,
        metadata: dict[str, Any],
    ) -> bool:
        now = utc_now()
        with self.transaction() as db:
            cursor = db.execute(
                """
                INSERT OR IGNORE INTO crawl_items
                (source_id, url, kind, depth, parent_url, metadata_json,
                 analysis_eligible, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source_id,
                    url,
                    kind.value,
                    depth,
                    parent_url,
                    json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                    int(metadata.get("annotation_status") != "metadata-required"),
                    ItemStatus.QUEUED.value,
                    now,
                    now,
                ),
            )
        return cursor.rowcount == 1

    def recover_stale_claims(self, stale_seconds: int) -> int:
        cutoff = (
            datetime.now(timezone.utc) - timedelta(seconds=stale_seconds)
        ).isoformat()
        with self.transaction() as db:
            cursor = db.execute(
                """
                UPDATE crawl_items
                SET status = ?, error = 'recovered stale claim', updated_at = ?
                WHERE status IN (?, ?) AND updated_at < ?
                """,
                (
                    ItemStatus.RETRY.value,
                    utc_now(),
                    ItemStatus.FETCHING.value,
                    ItemStatus.ANALYZING.value,
                    cutoff,
                ),
            )
        return cursor.rowcount

    def claim_for_fetch(self, source_id: str | None = None) -> CrawlItem | None:
        now = utc_now()
        where_source = "AND source_id = ?" if source_id else ""
        parameters: list[Any] = [ItemStatus.QUEUED.value, ItemStatus.RETRY.value, now]
        if source_id:
            parameters.append(source_id)
        with self.transaction() as db:
            row = db.execute(
                f"""
                SELECT * FROM crawl_items
                WHERE status IN (?, ?)
                  AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                  {where_source}
                ORDER BY item_id
                LIMIT 1
                """,
                parameters,
            ).fetchone()
            if row is None:
                return None
            updated = db.execute(
                """
                UPDATE crawl_items
                SET status = ?, attempts = attempts + 1, updated_at = ?
                WHERE item_id = ? AND status IN (?, ?)
                """,
                (
                    ItemStatus.FETCHING.value,
                    now,
                    row["item_id"],
                    ItemStatus.QUEUED.value,
                    ItemStatus.RETRY.value,
                ),
            )
            if updated.rowcount != 1:
                return None
        return CrawlItem(
            item_id=row["item_id"],
            source_id=row["source_id"],
            url=row["url"],
            kind=ItemKind(row["kind"]),
            depth=row["depth"],
            parent_url=row["parent_url"],
            metadata=json.loads(row["metadata_json"]),
            attempts=row["attempts"] + 1,
        )

    def claim_for_analysis(self, source_id: str | None = None) -> CrawlItem | None:
        where_source = "AND source_id = ?" if source_id else ""
        parameters: list[Any] = [ItemStatus.DOWNLOADED.value]
        if source_id:
            parameters.append(source_id)
        with self.transaction() as db:
            row = db.execute(
                f"""
                SELECT * FROM crawl_items
                WHERE status = ? AND analysis_eligible = 1 {where_source}
                ORDER BY item_id
                LIMIT 1
                """,
                parameters,
            ).fetchone()
            if row is None:
                return None
            updated = db.execute(
                """
                UPDATE crawl_items SET status = ?, updated_at = ?
                WHERE item_id = ? AND status = ?
                """,
                (
                    ItemStatus.ANALYZING.value,
                    utc_now(),
                    row["item_id"],
                    ItemStatus.DOWNLOADED.value,
                ),
            )
            if updated.rowcount != 1:
                return None
        metadata = json.loads(row["metadata_json"])
        metadata["local_path"] = row["local_path"]
        metadata["content_hash"] = row["content_hash"]
        return CrawlItem(
            item_id=row["item_id"],
            source_id=row["source_id"],
            url=row["url"],
            kind=ItemKind(row["kind"]),
            depth=row["depth"],
            parent_url=row["parent_url"],
            metadata=metadata,
            attempts=row["attempts"],
        )

    def mark_downloaded(
        self, item_id: int, content_hash: str, local_path: Path
    ) -> None:
        with self.transaction() as db:
            db.execute(
                """
                UPDATE crawl_items
                SET status = ?, content_hash = ?, local_path = ?, error = NULL,
                    updated_at = ?
                WHERE item_id = ?
                """,
                (
                    ItemStatus.DOWNLOADED.value,
                    content_hash,
                    str(local_path),
                    utc_now(),
                    item_id,
                ),
            )

    def upsert_local_asset(
        self,
        *,
        source_id: str,
        url: str,
        metadata: dict[str, Any],
        content_hash: str,
        local_path: Path,
    ) -> tuple[int, str]:
        encoded = json.dumps(metadata, ensure_ascii=False, sort_keys=True)
        row = self.connection.execute(
            """
            SELECT item_id, metadata_json, content_hash, local_path
            FROM crawl_items WHERE source_id = ? AND url = ?
            """,
            (source_id, url),
        ).fetchone()
        now = utc_now()
        if row is None:
            with self.transaction() as db:
                cursor = db.execute(
                    """
                    INSERT INTO crawl_items
                    (source_id, url, kind, depth, parent_url, metadata_json,
                     analysis_eligible, status, content_hash, local_path,
                     created_at, updated_at)
                    VALUES (?, ?, ?, 0, NULL, ?, 1, ?, ?, ?, ?, ?)
                    """,
                    (
                        source_id,
                        url,
                        ItemKind.IMAGE.value,
                        encoded,
                        ItemStatus.DOWNLOADED.value,
                        content_hash,
                        str(local_path),
                        now,
                        now,
                    ),
                )
            return int(cursor.lastrowid), "created"

        item_id = int(row["item_id"])
        content_changed = (
            row["content_hash"] != content_hash
            or row["local_path"] != str(local_path)
        )
        metadata_changed = row["metadata_json"] != encoded
        if not content_changed and not metadata_changed:
            return item_id, "unchanged"
        with self.transaction() as db:
            if content_changed:
                db.execute("DELETE FROM analyses WHERE item_id = ?", (item_id,))
            db.execute(
                """
                UPDATE crawl_items
                SET metadata_json = ?, analysis_eligible = 1,
                    status = CASE WHEN ? THEN ? ELSE status END,
                    content_hash = ?, local_path = ?, error = NULL,
                    updated_at = ?
                WHERE item_id = ?
                """,
                (
                    encoded,
                    int(content_changed),
                    ItemStatus.DOWNLOADED.value,
                    content_hash,
                    str(local_path),
                    now,
                    item_id,
                ),
            )
        return item_id, "updated-content" if content_changed else "updated-metadata"

    def mark_complete(self, item_id: int) -> None:
        self._set_status(item_id, ItemStatus.COMPLETE)

    def mark_skipped(self, item_id: int, reason: str) -> None:
        self._set_status(item_id, ItemStatus.SKIPPED, error=reason)

    def mark_failed(self, item_id: int, error: str) -> None:
        self._set_status(item_id, ItemStatus.FAILED, error=error)

    def mark_retry(self, item_id: int, error: str, delay_seconds: float) -> None:
        retry_at = (
            datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        ).isoformat()
        self._set_status(
            item_id, ItemStatus.RETRY, error=error, next_attempt_at=retry_at
        )

    def _set_status(
        self,
        item_id: int,
        status: ItemStatus,
        *,
        error: str | None = None,
        next_attempt_at: str | None = None,
    ) -> None:
        with self.transaction() as db:
            db.execute(
                """
                UPDATE crawl_items
                SET status = ?, error = ?, next_attempt_at = ?, updated_at = ?
                WHERE item_id = ?
                """,
                (status.value, error, next_attempt_at, utc_now(), item_id),
            )

    def add_analysis(
        self,
        *,
        item_id: int,
        profile_id: str,
        model_id: str,
        task: str,
        result: dict[str, Any],
    ) -> None:
        with self.transaction() as db:
            db.execute(
                """
                INSERT OR REPLACE INTO analyses
                (item_id, profile_id, model_id, task, result_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id,
                    profile_id,
                    model_id,
                    task,
                    json.dumps(result, ensure_ascii=False, sort_keys=True),
                    utc_now(),
                ),
            )

    def prior_analyses(self, item_id: int) -> list[dict[str, Any]]:
        rows = self.connection.execute(
            """
            SELECT profile_id, model_id, task, result_json
            FROM analyses WHERE item_id = ? ORDER BY analysis_id
            """,
            (item_id,),
        ).fetchall()
        return [
            {
                "profile_id": row["profile_id"],
                "model_id": row["model_id"],
                "task": row["task"],
                "result": json.loads(row["result_json"]),
            }
            for row in rows
        ]

    def audit(
        self,
        event_type: str,
        *,
        source_id: str | None = None,
        item_id: int | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        with self.transaction() as db:
            db.execute(
                """
                INSERT INTO audit_events
                (event_type, source_id, item_id, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    event_type,
                    source_id,
                    item_id,
                    json.dumps(payload or {}, ensure_ascii=False, sort_keys=True),
                    utc_now(),
                ),
            )

    def stats(self) -> dict[str, int]:
        rows = self.connection.execute(
            "SELECT status, COUNT(*) AS count FROM crawl_items GROUP BY status"
        ).fetchall()
        result = {row["status"]: row["count"] for row in rows}
        result["analyses"] = self.connection.execute(
            "SELECT COUNT(*) FROM analyses"
        ).fetchone()[0]
        result["audit_events"] = self.connection.execute(
            "SELECT COUNT(*) FROM audit_events"
        ).fetchone()[0]
        return result

    def source_item_count(self, source_id: str) -> int:
        return int(
            self.connection.execute(
                "SELECT COUNT(*) FROM crawl_items WHERE source_id = ?",
                (source_id,),
            ).fetchone()[0]
        )

    def import_metadata(
        self, source_id: str, url: str, metadata: dict[str, Any]
    ) -> bool:
        row = self.connection.execute(
            """
            SELECT item_id, metadata_json FROM crawl_items
            WHERE source_id = ? AND url = ?
            """,
            (source_id, url),
        ).fetchone()
        if row is None:
            return False
        merged = json.loads(row["metadata_json"])
        merged.update(metadata)
        merged["annotation_status"] = "ready"
        with self.transaction() as db:
            db.execute(
                """
                UPDATE crawl_items
                SET metadata_json = ?, analysis_eligible = 1, updated_at = ?
                WHERE item_id = ?
                """,
                (
                    json.dumps(merged, ensure_ascii=False, sort_keys=True),
                    utc_now(),
                    row["item_id"],
                ),
            )
        self.audit(
            "metadata_imported",
            source_id=source_id,
            item_id=row["item_id"],
            payload={"fields": sorted(metadata)},
        )
        return True
