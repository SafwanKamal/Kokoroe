from __future__ import annotations

import argparse
from contextlib import contextmanager
import fcntl
import json
from pathlib import Path
import sys
from typing import Iterator

from .config import load_config
from .contracts import (
    AnalysisError,
    ConfigurationError,
    CrawlError,
    PolicyError,
)
from .pipeline import MangaCrawler
from .security import URLPolicy


@contextmanager
def run_lock(output_dir: Path) -> Iterator[None]:
    output_dir.mkdir(parents=True, exist_ok=True)
    lock_path = output_dir / ".crawler.lock"
    with lock_path.open("a+", encoding="utf-8") as handle:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError(
                f"another crawler process holds {lock_path}"
            ) from exc
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="kokoroe-manga-crawler",
        description=(
            "Crawl explicitly authorized manga sources and prepare them for "
            "task-tuned analysis."
        ),
    )
    parser.add_argument(
        "--config",
        type=Path,
        required=True,
        help="Path to a version-1 JSON configuration file.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("validate", help="Validate policy, sources, and models.")

    dry = subparsers.add_parser(
        "dry-run", help="List authorized seeds without network access."
    )
    dry.add_argument("--source")

    crawl = subparsers.add_parser("crawl", help="Download authorized source assets.")
    crawl.add_argument("--source")
    crawl.add_argument("--limit", type=int)
    crawl.add_argument(
        "--acknowledge-rights",
        action="store_true",
        help="Required confirmation that configured source rights were reviewed.",
    )

    analyze = subparsers.add_parser(
        "analyze", help="Run enabled specialist analyzers over downloaded assets."
    )
    analyze.add_argument("--source")
    analyze.add_argument("--limit", type=int)
    analyze.add_argument(
        "--acknowledge-model-licenses",
        action="store_true",
        help="Required confirmation that configured model licenses were reviewed.",
    )

    metadata = subparsers.add_parser(
        "import-metadata",
        help="Import reviewed JSONL metadata for discovered image URLs.",
    )
    metadata.add_argument("--file", type=Path, required=True)

    local = subparsers.add_parser(
        "import-local",
        help="Import reviewed local image files from source-allowlisted roots.",
    )
    local.add_argument("--manifest", type=Path, required=True)
    local.add_argument("--source")
    local.add_argument("--limit", type=int)
    local.add_argument(
        "--acknowledge-rights",
        action="store_true",
        help="Required confirmation that configured source rights were reviewed.",
    )

    run = subparsers.add_parser(
        "run", help="Initialize, crawl, and analyze in one resumable run."
    )
    run.add_argument("--source")
    run.add_argument("--crawl-limit", type=int)
    run.add_argument("--analysis-limit", type=int)
    run.add_argument("--acknowledge-rights", action="store_true")
    run.add_argument("--acknowledge-model-licenses", action="store_true")

    subparsers.add_parser("stats", help="Print persistent queue statistics.")
    return parser


def _validate_source(config, source_id: str | None) -> None:
    if not source_id:
        return
    enabled = {source.source_id for source in config.sources if source.enabled}
    if source_id not in enabled:
        raise ConfigurationError(
            f"source {source_id!r} is missing or disabled"
        )


def _print_json(value) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def main(argv: list[str] | None = None) -> None:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        config = load_config(args.config.resolve())
        source_id = getattr(args, "source", None)
        _validate_source(config, source_id)

        if args.command == "validate":
            _print_json(
                {
                    "valid": True,
                    "purpose": config.run.purpose,
                    "output_dir": str(config.run.output_dir),
                    "enabled_sources": [
                        source.source_id
                        for source in config.sources
                        if source.enabled
                    ],
                    "enabled_specialist_models": [
                        {
                            "profile_id": profile.profile_id,
                            "model_id": profile.model_id,
                            "task": profile.task,
                            "license": profile.license,
                        }
                        for profile in config.models
                        if profile.enabled
                    ],
                }
            )
            return

        if args.command == "dry-run":
            sources = [
                source
                for source in config.sources
                if source.enabled
                and (source_id is None or source.source_id == source_id)
            ]
            _print_json(
                {
                    "network_used": False,
                    "sources": [
                        {
                            "source_id": source.source_id,
                            "authorization_id": source.rights.authorization_id,
                            "basis": source.rights.basis.value,
                            "asset_seeds": len(source.assets),
                            "html_seeds": (
                                len(source.discovery.seed_urls)
                                if source.discovery
                                else 0
                            ),
                            "allowed_domains": list(source.allowed_domains),
                            "local_roots": (
                                [
                                    str(root)
                                    for root in source.local_import.allowed_roots
                                ]
                                if source.local_import
                                else []
                            ),
                            "local_max_files": (
                                source.local_import.max_files
                                if source.local_import
                                else 0
                            ),
                        }
                        for source in sources
                    ],
                }
            )
            return

        if args.command in {"crawl", "import-local", "run"} and not args.acknowledge_rights:
            parser.error(
                f"{args.command} requires --acknowledge-rights after reviewing "
                "every configured source authorization"
            )
        if (
            args.command in {"analyze", "run"}
            and not args.acknowledge_model_licenses
        ):
            parser.error(
                f"{args.command} requires --acknowledge-model-licenses after "
                "reviewing every enabled specialist model"
            )

        with run_lock(config.run.output_dir):
            crawler = MangaCrawler(config)
            try:
                if args.command == "stats":
                    _print_json(crawler.state.stats())
                    return
                if args.command == "import-metadata":
                    imported = 0
                    missing = []
                    for line_number, line in enumerate(
                        args.file.read_text(encoding="utf-8").splitlines(), start=1
                    ):
                        if not line.strip():
                            continue
                        try:
                            record = json.loads(line)
                        except json.JSONDecodeError as exc:
                            raise ConfigurationError(
                                f"{args.file}:{line_number}: invalid JSON"
                            ) from exc
                        required = {
                            "source_id",
                            "url",
                            "work_id",
                            "scene_id",
                            "page_index",
                        }
                        if not isinstance(record, dict) or not required.issubset(record):
                            raise ConfigurationError(
                                f"{args.file}:{line_number}: missing one of "
                                + ", ".join(sorted(required))
                            )
                        source = str(record.pop("source_id"))
                        source_config = crawler.sources.get(source)
                        if source_config is None:
                            raise ConfigurationError(
                                f"{args.file}:{line_number}: source is missing or disabled"
                            )
                        url = URLPolicy(
                            source_config, config.run.allow_private_hosts
                        ).normalize_and_validate(
                            str(record.pop("url")), check_network=False
                        )
                        if (
                            not isinstance(record.get("work_id"), str)
                            or not record["work_id"].strip()
                            or not isinstance(record.get("scene_id"), str)
                            or not record["scene_id"].strip()
                            or not isinstance(record.get("page_index"), int)
                            or record["page_index"] < 0
                        ):
                            raise ConfigurationError(
                                f"{args.file}:{line_number}: work_id and scene_id "
                                "must be text and page_index must be non-negative"
                            )
                        for field in ("context_before", "character_hints"):
                            value = record.get(field, [])
                            if not isinstance(value, list) or not all(
                                isinstance(item, str) for item in value
                            ):
                                raise ConfigurationError(
                                    f"{args.file}:{line_number}: {field} must be "
                                    "an array of strings"
                                )
                        if crawler.state.import_metadata(source, url, record):
                            imported += 1
                        else:
                            missing.append({"source_id": source, "url": url})
                    _print_json({"imported": imported, "missing": missing})
                    return
                if args.command == "import-local":
                    result = crawler.import_local_manifest(
                        args.manifest.resolve(),
                        selected_source=source_id,
                        limit=args.limit,
                    )
                    _print_json({"imports": result, "stats": crawler.state.stats()})
                    return
                if args.command == "crawl":
                    queued = crawler.initialize_queue(source_id)
                    processed = crawler.crawl(
                        selected_source=source_id, limit=args.limit
                    )
                    _print_json(
                        {
                            "queued": queued,
                            "processed": processed,
                            "stats": crawler.state.stats(),
                        }
                    )
                    return
                if args.command == "analyze":
                    processed = crawler.analyze(
                        selected_source=source_id, limit=args.limit
                    )
                    _print_json(
                        {"processed": processed, "stats": crawler.state.stats()}
                    )
                    return
                if args.command == "run":
                    queued = crawler.initialize_queue(source_id)
                    crawled = crawler.crawl(
                        selected_source=source_id, limit=args.crawl_limit
                    )
                    analyzed = crawler.analyze(
                        selected_source=source_id, limit=args.analysis_limit
                    )
                    _print_json(
                        {
                            "queued": queued,
                            "crawled": crawled,
                            "analyzed": analyzed,
                            "stats": crawler.state.stats(),
                        }
                    )
                    return
            finally:
                crawler.close()
    except (
        AnalysisError,
        ConfigurationError,
        CrawlError,
        PolicyError,
        RuntimeError,
        OSError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
