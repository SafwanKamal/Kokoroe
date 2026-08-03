from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import struct
import tempfile
from typing import Any

from .contracts import CrawlError, StoredAsset


MEDIA_EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}


def _probe_png(data: bytes) -> tuple[str, int, int] | None:
    if len(data) >= 24 and data.startswith(b"\x89PNG\r\n\x1a\n"):
        width, height = struct.unpack(">II", data[16:24])
        return "png", width, height
    return None


def _probe_gif(data: bytes) -> tuple[str, int, int] | None:
    if len(data) >= 10 and data[:6] in {b"GIF87a", b"GIF89a"}:
        width, height = struct.unpack("<HH", data[6:10])
        return "gif", width, height
    return None


def _probe_webp(data: bytes) -> tuple[str, int, int] | None:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    chunk = data[12:16]
    if chunk == b"VP8X" and len(data) >= 30:
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return "webp", width, height
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        width = (bits & 0x3FFF) + 1
        height = ((bits >> 14) & 0x3FFF) + 1
        return "webp", width, height
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        width = int.from_bytes(data[26:28], "little") & 0x3FFF
        height = int.from_bytes(data[28:30], "little") & 0x3FFF
        return "webp", width, height
    return None


def _probe_jpeg(data: bytes) -> tuple[str, int, int] | None:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return None
    index = 2
    while index + 4 <= len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        while index < len(data) and data[index] == 0xFF:
            index += 1
        if index >= len(data):
            break
        marker = data[index]
        index += 1
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if index + 2 > len(data):
            break
        length = int.from_bytes(data[index : index + 2], "big")
        if length < 2 or index + length > len(data):
            break
        if marker in {
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        }:
            if length < 7:
                break
            height = int.from_bytes(data[index + 3 : index + 5], "big")
            width = int.from_bytes(data[index + 5 : index + 7], "big")
            return "jpeg", width, height
        index += length
    return None


def probe_image(data: bytes, max_pixels: int) -> tuple[str, int, int]:
    result = (
        _probe_png(data)
        or _probe_gif(data)
        or _probe_webp(data)
        or _probe_jpeg(data)
    )
    if result is None:
        raise CrawlError("downloaded bytes are not a supported image")
    image_format, width, height = result
    if width <= 0 or height <= 0:
        raise CrawlError("image dimensions must be positive")
    if width * height > max_pixels:
        raise CrawlError(
            f"image dimensions {width}x{height} exceed pixel safety limit"
        )
    return image_format, width, height


class AssetStore:
    def __init__(self, root: Path, max_pixels: int):
        self.root = root
        self.max_pixels = max_pixels
        self.blob_root = root / "blobs" / "sha256"
        self.record_root = root / "records"
        for directory in (root, self.blob_root, self.record_root):
            directory.mkdir(parents=True, exist_ok=True)
            try:
                directory.chmod(0o700)
            except OSError:
                pass

    def store(
        self,
        data: bytes,
        media_type: str,
        metadata: dict[str, Any],
    ) -> StoredAsset:
        if media_type not in MEDIA_EXTENSIONS:
            raise CrawlError(f"unsupported image media type {media_type!r}")
        image_format, width, height = probe_image(data, self.max_pixels)
        expected = MEDIA_EXTENSIONS[media_type]
        normalized_format = "jpg" if image_format == "jpeg" else image_format
        if normalized_format != expected:
            raise CrawlError(
                f"content type {media_type!r} does not match {image_format!r} bytes"
            )
        digest = hashlib.sha256(data).hexdigest()
        directory = self.blob_root / digest[:2]
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{digest}.{expected}"
        if not path.exists():
            self._atomic_write(path, data)
        asset = StoredAsset(
            sha256=digest,
            path=path,
            byte_length=len(data),
            media_type=media_type,
            image_format=image_format,
            width=width,
            height=height,
        )
        record = {
            "schema_version": 1,
            "asset": asset.to_json(),
            "source": metadata,
        }
        record_bytes = json.dumps(
            record, ensure_ascii=False, indent=2, sort_keys=True
        ).encode("utf-8")
        record_digest = hashlib.sha256(record_bytes).hexdigest()
        self._atomic_write(
            self.record_root / digest / f"{record_digest}.json",
            record_bytes,
        )
        return asset

    @staticmethod
    def _atomic_write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        file_descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{path.name}.", dir=path.parent
        )
        try:
            os.fchmod(file_descriptor, 0o600)
            with os.fdopen(file_descriptor, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, path)
        except BaseException:
            try:
                os.close(file_descriptor)
            except OSError:
                pass
            try:
                os.unlink(temporary_name)
            except OSError:
                pass
            raise
