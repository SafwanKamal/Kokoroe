from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from kokoroe_manga_crawler.contracts import ItemKind
from kokoroe_manga_crawler.state import CrawlState


class StateTests(unittest.TestCase):
    def test_queue_resume_analysis_and_metadata_gate(self):
        with tempfile.TemporaryDirectory() as temp:
            state = CrawlState(Path(temp) / "state.sqlite3")
            try:
                self.assertTrue(
                    state.enqueue(
                        source_id="source",
                        url="https://example.test/page.png",
                        kind=ItemKind.IMAGE,
                        depth=0,
                        parent_url=None,
                        metadata={"work_id": "work"},
                    )
                )
                self.assertFalse(
                    state.enqueue(
                        source_id="source",
                        url="https://example.test/page.png",
                        kind=ItemKind.IMAGE,
                        depth=0,
                        parent_url=None,
                        metadata={},
                    )
                )
                item = state.claim_for_fetch()
                self.assertIsNotNone(item)
                state.mark_downloaded(item.item_id, "abc", Path("/tmp/abc.png"))
                analysis_item = state.claim_for_analysis()
                self.assertEqual(analysis_item.item_id, item.item_id)
                state.add_analysis(
                    item_id=item.item_id,
                    profile_id="layout",
                    model_id="model",
                    task="manga-layout-transcription",
                    result={"panels": []},
                )
                state.mark_complete(item.item_id)
                self.assertEqual(state.stats()["complete"], 1)
                self.assertEqual(state.stats()["analyses"], 1)

                state.enqueue(
                    source_id="source",
                    url="https://example.test/discovered.png",
                    kind=ItemKind.IMAGE,
                    depth=1,
                    parent_url="https://example.test/index",
                    metadata={"annotation_status": "metadata-required"},
                )
                gated = state.claim_for_fetch()
                state.mark_downloaded(gated.item_id, "def", Path("/tmp/def.png"))
                self.assertIsNone(state.claim_for_analysis())
                self.assertTrue(
                    state.import_metadata(
                        "source",
                        "https://example.test/discovered.png",
                        {
                            "work_id": "work",
                            "scene_id": "scene",
                            "page_index": 1,
                        },
                    )
                )
                self.assertEqual(state.claim_for_analysis().item_id, gated.item_id)
            finally:
                state.close()


if __name__ == "__main__":
    unittest.main()
