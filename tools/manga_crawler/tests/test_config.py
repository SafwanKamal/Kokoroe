from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from kokoroe_manga_crawler.config import load_config
from kokoroe_manga_crawler.contracts import ConfigurationError, PolicyError


def configuration() -> dict:
    return {
        "schema_version": 1,
        "run": {
            "output_dir": "output",
            "purpose": "research-evaluation",
            "user_agent": "Crawler/1.0",
            "contact": "operator@example.test",
        },
        "sources": [
            {
                "source_id": "licensed",
                "enabled": True,
                "rights": {
                    "authorization_id": "contract-1",
                    "basis": "explicit-permission",
                    "evidence": "/records/contract-1.pdf",
                    "permitted_purposes": ["research-evaluation"],
                },
                "allowed_domains": ["assets.example.test"],
                "allowed_path_prefixes": ["/authorized/"],
                "delay_seconds": 1,
                "assets": [
                    {
                        "url": "https://assets.example.test/authorized/001.png",
                        "work_id": "work",
                        "scene_id": "scene",
                        "page_index": 0,
                    }
                ],
            }
        ],
        "models": [],
    }


class ConfigTests(unittest.TestCase):
    def load(self, value: dict):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "config.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            return load_config(path)

    def test_loads_authorized_direct_source(self):
        config = self.load(configuration())
        self.assertEqual(config.sources[0].rights.authorization_id, "contract-1")
        self.assertEqual(config.sources[0].assets[0].scene_id, "scene")
        self.assertTrue(config.run.output_dir.is_absolute())

    def test_loads_local_only_source_with_resolved_root(self):
        value = configuration()
        value["sources"] = [
            {
                "source_id": "local-open",
                "enabled": True,
                "rights": {
                    "authorization_id": "cc-by-source",
                    "basis": "open-license",
                    "evidence": "https://example.test/license",
                    "permitted_purposes": ["research-evaluation"],
                    "redistribution_allowed": True,
                },
                "local_import": {
                    "allowed_roots": ["source-checkout"],
                    "max_files": 5,
                },
            }
        ]
        config = self.load(value)
        local = config.sources[0].local_import
        self.assertIsNotNone(local)
        self.assertTrue(local.allowed_roots[0].is_absolute())
        self.assertEqual(local.max_files, 5)

    def test_rejects_unpermitted_purpose(self):
        value = configuration()
        value["run"]["purpose"] = "commercial-training"
        with self.assertRaises(PolicyError):
            self.load(value)

    def test_rejects_general_model(self):
        value = configuration()
        value["models"] = [
            {
                "profile_id": "generic",
                "enabled": True,
                "adapter": "command-json",
                "task": "manga-context-normalization",
                "model_id": "generic/model",
                "tuned_for": ["manga-context-normalization"],
                "license": "test",
                "allowed_purposes": ["research-evaluation"],
                "general_purpose": True,
                "command": ["tool", "{input_json}", "{output_json}"],
            }
        ]
        with self.assertRaises(PolicyError):
            self.load(value)

    def test_ocr_requires_earlier_layout_model(self):
        value = configuration()
        value["models"] = [
            {
                "profile_id": "ocr",
                "enabled": True,
                "adapter": "manga-ocr",
                "task": "manga-ocr",
                "model_id": "kha-white/manga-ocr-base",
                "tuned_for": ["manga-ocr"],
                "license": "Apache-2.0",
                "allowed_purposes": ["research-evaluation"],
            }
        ]
        with self.assertRaises(ConfigurationError):
            self.load(value)


if __name__ == "__main__":
    unittest.main()
