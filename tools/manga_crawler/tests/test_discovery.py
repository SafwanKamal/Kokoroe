from __future__ import annotations

import unittest

from kokoroe_manga_crawler.http import LinkExtractor


class DiscoveryTests(unittest.TestCase):
    def test_extracts_and_resolves_links(self):
        parser = LinkExtractor("https://example.test/authorized/index.html")
        parser.feed(
            """
            <a href="chapter-1.html">Chapter</a>
            <img data-src="/authorized/images/page-1.png">
            """
        )
        self.assertIn(
            "https://example.test/authorized/chapter-1.html", parser.links
        )
        self.assertIn(
            "https://example.test/authorized/images/page-1.png", parser.images
        )


if __name__ == "__main__":
    unittest.main()
