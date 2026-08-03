from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from .analysis import AnalyzerRunner
from .config import AppConfig
from .contracts import (
    AnalysisError,
    CrawlError,
    CrawlItem,
    ItemKind,
    PolicyError,
    SourceConfig,
)
from .http import Fetcher, LinkExtractor, RobotsGuard
from .local_import import LocalManifestImporter
from .security import URLPolicy
from .state import CrawlState
from .storage import AssetStore


IMAGE_TYPES = ("image/png", "image/jpeg", "image/gif", "image/webp")


class MangaCrawler:
    def __init__(self, config: AppConfig):
        self.config = config
        output = config.run.output_dir
        output.mkdir(parents=True, exist_ok=True)
        self.state = CrawlState(output / "crawler.sqlite3")
        self.fetcher = Fetcher(config.run)
        self.robots = RobotsGuard(self.fetcher)
        self.assets = AssetStore(output, config.run.max_image_pixels)
        self.analyzers = AnalyzerRunner(config.run)
        self.sources = {
            source.source_id: source for source in config.sources if source.enabled
        }

    def close(self) -> None:
        self.state.close()

    def initialize_queue(self, selected_source: str | None = None) -> int:
        count = 0
        for source in self.sources.values():
            if selected_source and source.source_id != selected_source:
                continue
            policy = URLPolicy(source, self.config.run.allow_private_hosts)
            for asset in source.assets:
                url = policy.normalize_and_validate(asset.url, check_network=False)
                if self.state.enqueue(
                    source_id=source.source_id,
                    url=url,
                    kind=ItemKind.IMAGE,
                    depth=0,
                    parent_url=None,
                    metadata={
                        "work_id": asset.work_id,
                        "scene_id": asset.scene_id,
                        "chapter_id": asset.chapter_id,
                        "page_index": asset.page_index,
                        "context_before": list(asset.context_before),
                        "character_hints": list(asset.character_hints),
                        "authorization_id": source.rights.authorization_id,
                        "rights_basis": source.rights.basis.value,
                    },
                ):
                    count += 1
            if source.discovery:
                for seed_url in source.discovery.seed_urls:
                    url = policy.normalize_and_validate(
                        seed_url, check_network=False
                    )
                    if self.state.enqueue(
                        source_id=source.source_id,
                        url=url,
                        kind=ItemKind.HTML,
                        depth=0,
                        parent_url=None,
                        metadata={
                            "authorization_id": source.rights.authorization_id,
                            "rights_basis": source.rights.basis.value,
                            "annotation_status": "metadata-required",
                        },
                    ):
                        count += 1
        self.state.audit("queue_initialized", payload={"new_items": count})
        return count

    def crawl(
        self,
        *,
        selected_source: str | None = None,
        limit: int | None = None,
    ) -> int:
        self.state.recover_stale_claims(self.config.run.stale_claim_seconds)
        processed = 0
        while limit is None or processed < limit:
            item = self.state.claim_for_fetch(selected_source)
            if item is None:
                break
            source = self.sources[item.source_id]
            try:
                self._fetch_item(source, item)
            except PolicyError as exc:
                self.state.mark_skipped(item.item_id, str(exc))
                self.state.audit(
                    "item_policy_rejected",
                    source_id=item.source_id,
                    item_id=item.item_id,
                    payload={"error": str(exc)},
                )
            except CrawlError as exc:
                if item.attempts <= self.config.run.max_retries:
                    delay = self.config.run.retry_base_seconds * (
                        2 ** max(0, item.attempts - 1)
                    )
                    self.state.mark_retry(item.item_id, str(exc), delay)
                else:
                    self.state.mark_failed(item.item_id, str(exc))
                self.state.audit(
                    "item_fetch_error",
                    source_id=item.source_id,
                    item_id=item.item_id,
                    payload={"error": str(exc), "attempt": item.attempts},
                )
            processed += 1
        return processed

    def _fetch_item(self, source: SourceConfig, item: CrawlItem) -> None:
        if not self.robots.can_fetch(source, item.url):
            raise PolicyError(f"robots policy disallows {item.url}")
        if item.kind == ItemKind.HTML:
            self._fetch_html(source, item)
        else:
            self._fetch_image(source, item)

    def _fetch_html(self, source: SourceConfig, item: CrawlItem) -> None:
        discovery = source.discovery
        if discovery is None:
            raise PolicyError("HTML item has no discovery policy")
        response = self.fetcher.fetch(
            source,
            item.url,
            max_bytes=self.config.run.max_html_bytes,
            accepted_types=("text/html",),
        )
        parser = LinkExtractor(response.url)
        parser.feed(response.body.decode("utf-8", errors="replace"))
        policy = URLPolicy(source, self.config.run.allow_private_hosts)
        page_pattern = re.compile(discovery.page_link_regex or r"(?!x)x")
        image_pattern = re.compile(discovery.image_url_regex or r"(?!x)x")
        discovered = 0
        if item.depth < discovery.max_depth:
            discovered += self._enqueue_discovered(
                source,
                item,
                parser.links,
                ItemKind.HTML,
                page_pattern,
                policy,
                discovery.max_urls,
            )
        discovered += self._enqueue_discovered(
            source,
            item,
            parser.images,
            ItemKind.IMAGE,
            image_pattern,
            policy,
            discovery.max_urls,
        )
        self.state.mark_complete(item.item_id)
        self.state.audit(
            "html_discovered",
            source_id=item.source_id,
            item_id=item.item_id,
            payload={"new_items": discovered},
        )

    def _enqueue_discovered(
        self,
        source: SourceConfig,
        parent: CrawlItem,
        urls: Iterable[str],
        kind: ItemKind,
        pattern: re.Pattern[str],
        policy: URLPolicy,
        max_urls: int,
    ) -> int:
        count = 0
        for candidate in sorted(urls):
            if self.state.source_item_count(source.source_id) >= max_urls:
                break
            try:
                normalized = policy.normalize_and_validate(
                    candidate, check_network=False
                )
            except PolicyError:
                continue
            if not pattern.search(normalized):
                continue
            if self.state.enqueue(
                source_id=source.source_id,
                url=normalized,
                kind=kind,
                depth=parent.depth + 1,
                parent_url=parent.url,
                metadata={
                    "authorization_id": source.rights.authorization_id,
                    "rights_basis": source.rights.basis.value,
                    "annotation_status": "metadata-required",
                    "discovered_from": parent.url,
                },
            ):
                count += 1
        return count

    def _fetch_image(self, source: SourceConfig, item: CrawlItem) -> None:
        response = self.fetcher.fetch(
            source,
            item.url,
            max_bytes=self.config.run.max_image_bytes,
            accepted_types=IMAGE_TYPES,
        )
        metadata = {
            **item.metadata,
            "source_id": source.source_id,
            "source_url": response.url,
            "authorization_id": source.rights.authorization_id,
            "rights_basis": source.rights.basis.value,
            "permitted_purpose": self.config.run.purpose,
            "redistribution_allowed": source.rights.redistribution_allowed,
        }
        asset = self.assets.store(response.body, response.content_type, metadata)
        self.state.mark_downloaded(item.item_id, asset.sha256, asset.path)
        self.state.audit(
            "image_downloaded",
            source_id=item.source_id,
            item_id=item.item_id,
            payload={
                "sha256": asset.sha256,
                "bytes": asset.byte_length,
                "width": asset.width,
                "height": asset.height,
            },
        )

    def analyze(
        self,
        *,
        selected_source: str | None = None,
        limit: int | None = None,
    ) -> int:
        processed = 0
        profiles = [profile for profile in self.config.models if profile.enabled]
        if not profiles:
            raise AnalysisError(
                "no specialist model profiles are enabled; downloaded items were "
                "left pending for analysis"
            )
        while limit is None or processed < limit:
            item = self.state.claim_for_analysis(selected_source)
            if item is None:
                break
            try:
                prior = self.state.prior_analyses(item.item_id)
                for profile in profiles:
                    result = self.analyzers.run(profile, item, prior)
                    self.state.add_analysis(
                        item_id=item.item_id,
                        profile_id=profile.profile_id,
                        model_id=profile.model_id,
                        task=profile.task,
                        result=result,
                    )
                    prior.append(
                        {
                            "profile_id": profile.profile_id,
                            "model_id": profile.model_id,
                            "task": profile.task,
                            "result": result,
                        }
                    )
                self.state.mark_complete(item.item_id)
                self.state.audit(
                    "image_analyzed",
                    source_id=item.source_id,
                    item_id=item.item_id,
                    payload={"profiles": [profile.profile_id for profile in profiles]},
                )
            except (AnalysisError, OSError) as exc:
                self.state.mark_failed(item.item_id, str(exc))
                self.state.audit(
                    "analysis_error",
                    source_id=item.source_id,
                    item_id=item.item_id,
                    payload={"error": str(exc)},
                )
            processed += 1
        return processed

    def import_local_manifest(
        self,
        manifest_path: Path,
        *,
        selected_source: str | None = None,
        limit: int | None = None,
    ) -> dict[str, int]:
        importer = LocalManifestImporter(
            sources=self.sources,
            state=self.state,
            assets=self.assets,
            max_image_bytes=self.config.run.max_image_bytes,
            max_image_pixels=self.config.run.max_image_pixels,
            purpose=self.config.run.purpose,
        )
        return importer.import_manifest(
            manifest_path,
            selected_source=selected_source,
            limit=limit,
        )
