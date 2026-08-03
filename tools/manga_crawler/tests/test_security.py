from __future__ import annotations

import unittest

from kokoroe_manga_crawler.contracts import (
    RightsBasis,
    RightsRecord,
    SourceConfig,
)
from kokoroe_manga_crawler.contracts import PolicyError
from kokoroe_manga_crawler.security import URLPolicy, endpoint_is_local


def source() -> SourceConfig:
    return SourceConfig(
        source_id="licensed",
        enabled=True,
        rights=RightsRecord(
            authorization_id="contract",
            basis=RightsBasis.EXPLICIT_PERMISSION,
            evidence="/contract.pdf",
            permitted_purposes=("research-evaluation",),
        ),
        allowed_domains=("assets.example.test",),
        allowed_path_prefixes=("/authorized/",),
        delay_seconds=1,
    )


class SecurityTests(unittest.TestCase):
    def test_normalizes_allowed_url(self):
        result = URLPolicy(source()).normalize_and_validate(
            "https://assets.example.test/authorized/a/../page.png#fragment",
            check_network=False,
        )
        self.assertEqual(
            result, "https://assets.example.test/authorized/page.png"
        )

    def test_rejects_domain_escape(self):
        with self.assertRaises(PolicyError):
            URLPolicy(source()).normalize_and_validate(
                "https://evil.example/authorized/page.png", check_network=False
            )

    def test_rejects_prefix_confusion(self):
        with self.assertRaises(PolicyError):
            URLPolicy(source()).normalize_and_validate(
                "https://assets.example.test/authorized-evil/page.png",
                check_network=False,
            )

    def test_rejects_url_credentials(self):
        with self.assertRaises(PolicyError):
            URLPolicy(source()).normalize_and_validate(
                "https://user:secret@assets.example.test/authorized/page.png",
                check_network=False,
            )

    def test_local_endpoint_detection(self):
        self.assertTrue(endpoint_is_local("http://127.0.0.1:8000/analyze"))
        self.assertTrue(endpoint_is_local("http://localhost:8000/analyze"))
        self.assertFalse(endpoint_is_local("https://models.example/analyze"))


if __name__ == "__main__":
    unittest.main()
