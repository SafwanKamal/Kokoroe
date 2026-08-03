#!/usr/bin/env python3

from pathlib import Path
import sys
import unittest


CRAWLER_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(CRAWLER_ROOT / "src"))


def main() -> int:
    suite = unittest.defaultTestLoader.discover(str(CRAWLER_ROOT / "tests"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
