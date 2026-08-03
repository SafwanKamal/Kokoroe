from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from kokoroe_manga_crawler.analysis import AnalyzerRunner, validate_result
from kokoroe_manga_crawler.contracts import AnalysisError, RunConfig
from kokoroe_manga_crawler.litert_panel_text import (
    convert_detections,
    verify_model_sha256,
)


class AnalysisTests(unittest.TestCase):
    def test_runner_keeps_run_method_callable(self):
        runner = AnalyzerRunner(
            RunConfig(
                output_dir=Path("/tmp/crawler-test"),
                purpose="research-evaluation",
                user_agent="test",
                contact="test@example.invalid",
            )
        )
        self.assertTrue(callable(runner.run))

    def test_normalizes_layout_contract(self):
        result = validate_result(
            "manga-layout-transcription",
            {
                "panels": [
                    {"id": "p1", "bbox": [0, 0, 100, 200], "confidence": 0.9}
                ],
                "characters": [],
                "text_blocks": [],
                "reading_order": ["p1"],
                "speaker_links": [],
                "ignored": "not retained",
            },
        )
        self.assertNotIn("ignored", result)
        self.assertEqual(result["panels"][0]["id"], "p1")

    def test_rejects_unknown_panel_spec_fields(self):
        with self.assertRaises(AnalysisError):
            validate_result(
                "manga-context-normalization",
                {
                    "panel_specs": [
                        {
                            "should_generate": True,
                            "confidence": 0.8,
                            "arbitrary_css": "forbidden",
                        }
                    ]
                },
            )

    def test_accepts_should_not_generate(self):
        result = validate_result(
            "manga-context-normalization",
            {
                "panel_specs": [
                    {
                        "should_generate": False,
                        "reason": "no visual story beat",
                        "confidence": 0.95,
                        "characters": [],
                        "manga_effects": [],
                        "continuity_facts": [],
                        "exclusions": [],
                    }
                ]
            },
        )
        self.assertFalse(result["panel_specs"][0]["should_generate"])

    def test_converts_normalized_letterbox_detections_to_page_boxes(self):
        result = convert_detections(
            [
                [0.25, 0.125, 0.75, 0.875, 0.9, 0],
                [0.4, 0.3, 0.6, 0.5, 0.8, 1],
                [0.1, 0.1, 0.2, 0.2, 0.1, 0],
            ],
            image_width=800,
            image_height=1200,
            scale=0.5,
            pad_left=120,
            pad_top=20,
            confidence_threshold=0.25,
        )
        self.assertEqual(result["panels"][0]["bbox"], [80, 120, 640, 960])
        self.assertEqual(result["text_blocks"][0]["bbox"], [272, 344, 256, 256])
        self.assertEqual(result["characters"], [])
        self.assertEqual(result["reading_order"], [])

    def test_discards_detections_entirely_inside_letterbox_padding(self):
        result = convert_detections(
            [[0.0, 0.1, 0.1, 0.2, 0.95, 0]],
            image_width=800,
            image_height=1200,
            scale=0.5,
            pad_left=120,
            pad_top=20,
            confidence_threshold=0.25,
        )
        self.assertEqual(result["panels"], [])

    def test_rejects_unexpected_detector_rows(self):
        with self.assertRaises(ValueError):
            convert_detections(
                [[0, 0, 1]],
                image_width=100,
                image_height=100,
                scale=1,
                pad_left=0,
                pad_top=0,
                confidence_threshold=0.25,
            )

    def test_verifies_pinned_model_digest(self):
        with TemporaryDirectory() as temp:
            model = Path(temp) / "model.tflite"
            model.write_bytes(b"pinned-model")
            verify_model_sha256(
                model,
                "8784c05c1dba20e7347b3954f1916de"
                "1ecbd38f5a2cce90063933a1ea03892d9",
            )
            with self.assertRaises(ValueError):
                verify_model_sha256(model, "0" * 64)


if __name__ == "__main__":
    unittest.main()
