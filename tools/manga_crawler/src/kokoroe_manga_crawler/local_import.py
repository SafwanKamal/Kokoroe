from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import quote

from .contracts import ConfigurationError, CrawlError, SourceConfig
from .state import CrawlState
from .storage import AssetStore, probe_image


FORMAT_MEDIA_TYPES = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
}

REQUIRED_FIELDS = {
    "source_id",
    "path",
    "work_id",
    "scene_id",
    "page_index",
    "source_revision",
    "attribution",
    "license",
}


class LocalManifestImporter:
    def __init__(
        self,
        *,
        sources: dict[str, SourceConfig],
        state: CrawlState,
        assets: AssetStore,
        max_image_bytes: int,
        max_image_pixels: int,
        purpose: str,
    ):
        self.sources = sources
        self.state = state
        self.assets = assets
        self.max_image_bytes = max_image_bytes
        self.max_image_pixels = max_image_pixels
        self.purpose = purpose

    def import_manifest(
        self,
        manifest_path: Path,
        *,
        selected_source: str | None = None,
        limit: int | None = None,
    ) -> dict[str, int]:
        counts = {
            "created": 0,
            "updated-content": 0,
            "updated-metadata": 0,
            "unchanged": 0,
        }
        per_source: dict[str, int] = {}
        processed = 0
        if limit is not None and limit <= 0:
            raise ConfigurationError("import limit must be positive")
        with manifest_path.open("r", encoding="utf-8") as manifest:
            for line_number, line in enumerate(manifest, start=1):
                if len(line) > 1_000_000:
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: manifest line is too large"
                    )
                if not line.strip():
                    continue
                if limit is not None and processed >= limit:
                    break
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: invalid JSON"
                    ) from exc
                if not isinstance(record, dict) or not REQUIRED_FIELDS.issubset(record):
                    missing = sorted(
                        REQUIRED_FIELDS - set(record)
                        if isinstance(record, dict)
                        else REQUIRED_FIELDS
                    )
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: missing fields: "
                        + ", ".join(missing)
                    )
                source_id = self._text(
                    record["source_id"], manifest_path, line_number, "source_id"
                )
                if selected_source and source_id != selected_source:
                    continue
                source = self.sources.get(source_id)
                if source is None or source.local_import is None:
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: source {source_id!r} "
                        "is missing, disabled, or has no local_import policy"
                    )
                per_source[source_id] = per_source.get(source_id, 0) + 1
                if per_source[source_id] > source.local_import.max_files:
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: source {source_id!r} "
                        "exceeds local_import.max_files"
                    )
                path, relative_path = self._resolve_path(
                    record["path"], source, manifest_path, line_number
                )
                stat = path.stat()
                if not path.is_file():
                    raise ConfigurationError(
                        f"{manifest_path}:{line_number}: {path} is not a regular file"
                    )
                if stat.st_size <= 0 or stat.st_size > self.max_image_bytes:
                    raise CrawlError(
                        f"{manifest_path}:{line_number}: {path} exceeds byte safety limit"
                    )
                data = path.read_bytes()
                image_format, _, _ = probe_image(data, self.max_image_pixels)
                media_type = FORMAT_MEDIA_TYPES[image_format]
                metadata = self._metadata(
                    record, source, relative_path, manifest_path, line_number
                )
                asset = self.assets.store(data, media_type, metadata)
                local_url = (
                    f"local://{quote(source_id, safe='')}/"
                    f"{quote(relative_path.as_posix(), safe='/')}"
                )
                item_id, disposition = self.state.upsert_local_asset(
                    source_id=source_id,
                    url=local_url,
                    metadata=metadata,
                    content_hash=asset.sha256,
                    local_path=asset.path,
                )
                self.state.audit(
                    "local_asset_imported",
                    source_id=source_id,
                    item_id=item_id,
                    payload={
                        "disposition": disposition,
                        "source_path": relative_path.as_posix(),
                        "sha256": asset.sha256,
                    },
                )
                counts[disposition] += 1
                processed += 1
        counts["processed"] = processed
        return counts

    def _resolve_path(
        self,
        value: Any,
        source: SourceConfig,
        manifest_path: Path,
        line_number: int,
    ) -> tuple[Path, Path]:
        text = self._text(value, manifest_path, line_number, "path")
        candidate = Path(text)
        matches: list[tuple[Path, Path]] = []
        roots = source.local_import.allowed_roots
        if candidate.is_absolute():
            resolved = candidate.resolve(strict=True)
            for root in roots:
                if resolved.is_relative_to(root):
                    matches.append((resolved, resolved.relative_to(root)))
        else:
            if ".." in candidate.parts:
                raise ConfigurationError(
                    f"{manifest_path}:{line_number}: path traversal is forbidden"
                )
            for root in roots:
                try:
                    resolved = (root / candidate).resolve(strict=True)
                except FileNotFoundError:
                    continue
                if resolved.is_relative_to(root):
                    matches.append((resolved, resolved.relative_to(root)))
        if len(matches) != 1:
            raise ConfigurationError(
                f"{manifest_path}:{line_number}: path must resolve under exactly "
                "one configured local root"
            )
        return matches[0]

    def _metadata(
        self,
        record: dict[str, Any],
        source: SourceConfig,
        relative_path: Path,
        manifest_path: Path,
        line_number: int,
    ) -> dict[str, Any]:
        page_index = record["page_index"]
        if not isinstance(page_index, int) or page_index < 0:
            raise ConfigurationError(
                f"{manifest_path}:{line_number}: page_index must be non-negative"
            )
        metadata: dict[str, Any] = {
            "source_id": source.source_id,
            "source_path": relative_path.as_posix(),
            "source_revision": self._text(
                record["source_revision"],
                manifest_path,
                line_number,
                "source_revision",
            ),
            "work_id": self._text(
                record["work_id"], manifest_path, line_number, "work_id"
            ),
            "scene_id": self._text(
                record["scene_id"], manifest_path, line_number, "scene_id"
            ),
            "page_index": page_index,
            "attribution": self._text(
                record["attribution"], manifest_path, line_number, "attribution"
            ),
            "license": self._text(
                record["license"], manifest_path, line_number, "license"
            ),
            "authorization_id": source.rights.authorization_id,
            "rights_basis": source.rights.basis.value,
            "permitted_purpose": self.purpose,
            "redistribution_allowed": source.rights.redistribution_allowed,
            "annotation_status": "ready",
        }
        for field in ("chapter_id", "language", "source_url", "transcript_path"):
            value = record.get(field)
            if value is not None:
                metadata[field] = self._text(
                    value, manifest_path, line_number, field
                )
        for field in ("context_before", "character_hints"):
            value = record.get(field, [])
            if not isinstance(value, list) or not all(
                isinstance(item, str) and item.strip() for item in value
            ):
                raise ConfigurationError(
                    f"{manifest_path}:{line_number}: {field} must be an array "
                    "of non-empty strings"
                )
            metadata[field] = value
        return metadata

    @staticmethod
    def _text(
        value: Any, manifest_path: Path, line_number: int, field: str
    ) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ConfigurationError(
                f"{manifest_path}:{line_number}: {field} must be non-empty text"
            )
        return value.strip()
