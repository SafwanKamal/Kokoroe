#!/usr/bin/env python3

from pathlib import Path
import sys


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT / "src"))

from kokoroe_manga_crawler.cli import main


if __name__ == "__main__":
    main()
