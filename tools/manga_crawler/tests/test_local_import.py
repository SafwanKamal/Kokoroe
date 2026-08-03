from __future__ import annotations

import json
from pathlib import Path
import struct
import tempfile
import unittest

from kokoroe_manga_crawler.contracts import (
    LocalImportConfig,
    ConfigurationError,
    RightsBasis,
    RightsRecord,
    SourceConfig,
)
from kokoroe_manga_crawler.local_import import LocalManifestImporter
from kokoroe_manga_crawler.state import CrawlState
from kokoroe_manga_crawler.storage import AssetStore


def png_header(width: int = 12, height: int = 9) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + (b"\x00" * 8) + struct.pack(">II", width, height)


class LocalImportTests(unittest.TestCase):
    def test_import_is_allowlisted_idempotent_and_change_aware(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source_root = root / "source"
            source_root.mkdir()
            image = source_root / "page-001.png"
            image.write_bytes(png_header())
            manifest = root / "manifest.jsonl"
            record = {
                "source_id": "open-comic",
                "path": "page-001.png",
                "work_id": "work",
                "chapter_id": "chapter-1",
                "scene_id": "scene-1",
                "page_index": 0,
                "source_revision": "abc123",
                "attribution": "Artist Name",
                "license": "CC BY 4.0",
                "context_before": [],
                "character_hints": ["hero"],
            }
            manifest.write_text(json.dumps(record) + "\n", encoding="utf-8")
            source = SourceConfig(
                source_id="open-comic",
                enabled=True,
                rights=RightsRecord(
                    authorization_id="cc-by",
                    basis=RightsBasis.OPEN_LICENSE,
                    evidence="https://example.test/license",
                    permitted_purposes=("research-evaluation",),
                    redistribution_allowed=True,
                ),
                allowed_domains=(),
                allowed_path_prefixes=("/",),
                delay_seconds=0,
                local_import=LocalImportConfig(
                    allowed_roots=(source_root.resolve(),), max_files=2
                ),
            )
            state = CrawlState(root / "state.sqlite3")
            try:
                importer = LocalManifestImporter(
                    sources={source.source_id: source},
                    state=state,
                    assets=AssetStore(root / "store", 1_000_000),
                    max_image_bytes=1_000_000,
                    max_image_pixels=1_000_000,
                    purpose="research-evaluation",
                )
                first = importer.import_manifest(manifest)
                second = importer.import_manifest(manifest)
                self.assertEqual(first["created"], 1)
                self.assertEqual(second["unchanged"], 1)
                self.assertEqual(state.stats()["downloaded"], 1)

                image.write_bytes(png_header(width=13))
                changed = importer.import_manifest(manifest)
                self.assertEqual(changed["updated-content"], 1)
                self.assertEqual(state.stats()["downloaded"], 1)
            finally:
                state.close()

    def test_rejects_path_outside_allowlisted_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source_root = root / "source"
            source_root.mkdir()
            outside = root / "outside.png"
            outside.write_bytes(png_header())
            manifest = root / "manifest.jsonl"
            manifest.write_text(
                json.dumps(
                    {
                        "source_id": "open-comic",
                        "path": "../outside.png",
                        "work_id": "work",
                        "scene_id": "scene",
                        "page_index": 0,
                        "source_revision": "abc123",
                        "attribution": "Artist",
                        "license": "CC BY 4.0",
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            source = SourceConfig(
                source_id="open-comic",
                enabled=True,
                rights=RightsRecord(
                    authorization_id="cc-by",
                    basis=RightsBasis.OPEN_LICENSE,
                    evidence="https://example.test/license",
                    permitted_purposes=("research-evaluation",),
                ),
                allowed_domains=(),
                allowed_path_prefixes=("/",),
                delay_seconds=0,
                local_import=LocalImportConfig(
                    allowed_roots=(source_root.resolve(),)
                ),
            )
            state = CrawlState(root / "state.sqlite3")
            try:
                importer = LocalManifestImporter(
                    sources={source.source_id: source},
                    state=state,
                    assets=AssetStore(root / "store", 1_000_000),
                    max_image_bytes=1_000_000,
                    max_image_pixels=1_000_000,
                    purpose="research-evaluation",
                )
                with self.assertRaises(ConfigurationError):
                    importer.import_manifest(manifest)
            finally:
                state.close()


if __name__ == "__main__":
    unittest.main()
