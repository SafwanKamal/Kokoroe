from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from kokoroe_manga_crawler.contracts import CrawlError
from kokoroe_manga_crawler.storage import AssetStore, probe_image


def png_header(width: int, height: int) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x02\x00\x00\x00"
    )


class StorageTests(unittest.TestCase):
    def test_probes_png_dimensions(self):
        self.assertEqual(probe_image(png_header(640, 960), 1_000_000), ("png", 640, 960))

    def test_rejects_pixel_bomb(self):
        with self.assertRaises(CrawlError):
            probe_image(png_header(50_000, 50_000), 80_000_000)

    def test_content_addressed_store_preserves_multiple_records(self):
        with tempfile.TemporaryDirectory() as temp:
            store = AssetStore(Path(temp), max_pixels=1_000_000)
            data = png_header(100, 200)
            first = store.store(
                data, "image/png", {"source_url": "https://a.test/1.png"}
            )
            second = store.store(
                data, "image/png", {"source_url": "https://a.test/2.png"}
            )
            self.assertEqual(first.path, second.path)
            records = list((Path(temp) / "records" / first.sha256).glob("*.json"))
            self.assertEqual(len(records), 2)


if __name__ == "__main__":
    unittest.main()
