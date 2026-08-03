from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any


class ConfigurationError(ValueError):
    pass


class PolicyError(RuntimeError):
    pass


class CrawlError(RuntimeError):
    pass


class AnalysisError(RuntimeError):
    pass


class ItemKind(StrEnum):
    HTML = "html"
    IMAGE = "image"


class ItemStatus(StrEnum):
    QUEUED = "queued"
    FETCHING = "fetching"
    DOWNLOADED = "downloaded"
    ANALYZING = "analyzing"
    COMPLETE = "complete"
    RETRY = "retry"
    FAILED = "failed"
    SKIPPED = "skipped"


class RightsBasis(StrEnum):
    OWNED = "owned"
    COMMISSIONED = "commissioned"
    PUBLIC_DOMAIN = "public-domain"
    OPEN_LICENSE = "open-license"
    EXPLICIT_PERMISSION = "explicit-permission"


@dataclass(frozen=True)
class RightsRecord:
    authorization_id: str
    basis: RightsBasis
    evidence: str
    permitted_purposes: tuple[str, ...]
    redistribution_allowed: bool = False
    expires_at: str | None = None
    notes: str = ""

    def validate_for(self, purpose: str) -> None:
        if not self.authorization_id.strip():
            raise ConfigurationError("rights.authorization_id is required")
        if not self.evidence.strip():
            raise ConfigurationError("rights.evidence is required")
        if purpose not in self.permitted_purposes:
            raise PolicyError(
                f"purpose {purpose!r} is not authorized by {self.authorization_id!r}"
            )
        if self.expires_at:
            try:
                expiration = datetime.fromisoformat(self.expires_at)
            except ValueError as exc:
                raise ConfigurationError(
                    f"invalid rights expiration {self.expires_at!r}"
                ) from exc
            if expiration.tzinfo is None:
                raise ConfigurationError("rights.expires_at must include a timezone")
            if expiration <= datetime.now(timezone.utc):
                raise PolicyError(
                    f"authorization {self.authorization_id!r} has expired"
                )


@dataclass(frozen=True)
class AssetSeed:
    url: str
    work_id: str
    scene_id: str
    page_index: int
    chapter_id: str | None = None
    context_before: tuple[str, ...] = ()
    character_hints: tuple[str, ...] = ()


@dataclass(frozen=True)
class DiscoveryConfig:
    mode: str
    seed_urls: tuple[str, ...] = ()
    page_link_regex: str | None = None
    image_url_regex: str | None = None
    max_depth: int = 0
    max_urls: int = 100


@dataclass(frozen=True)
class LocalImportConfig:
    allowed_roots: tuple[Path, ...]
    max_files: int = 1_000


@dataclass(frozen=True)
class SourceConfig:
    source_id: str
    enabled: bool
    rights: RightsRecord
    allowed_domains: tuple[str, ...]
    allowed_path_prefixes: tuple[str, ...]
    delay_seconds: float
    assets: tuple[AssetSeed, ...] = ()
    discovery: DiscoveryConfig | None = None
    local_import: LocalImportConfig | None = None


@dataclass(frozen=True)
class ModelProfile:
    profile_id: str
    enabled: bool
    adapter: str
    task: str
    model_id: str
    tuned_for: tuple[str, ...]
    license: str
    allowed_purposes: tuple[str, ...]
    general_purpose: bool = False
    command: tuple[str, ...] = ()
    endpoint: str | None = None
    auth_token_env: str | None = None
    timeout_seconds: float = 180.0
    send_image_bytes: bool = False
    data_transfer_authorized: bool = False
    extra: dict[str, Any] = field(default_factory=dict)

    def validate_for(self, purpose: str) -> None:
        if self.general_purpose:
            raise PolicyError(
                f"model {self.profile_id!r} is marked general-purpose; "
                "the crawler requires a task-tuned analyzer"
            )
        if self.task not in self.tuned_for:
            raise PolicyError(
                f"model {self.profile_id!r} does not declare tuning for {self.task!r}"
            )
        if purpose not in self.allowed_purposes:
            raise PolicyError(
                f"model {self.profile_id!r} is not licensed for purpose {purpose!r}"
            )
        if not self.license.strip():
            raise ConfigurationError(
                f"model {self.profile_id!r} must declare its license"
            )


@dataclass(frozen=True)
class RunConfig:
    output_dir: Path
    purpose: str
    user_agent: str
    contact: str
    request_timeout_seconds: float = 30.0
    max_retries: int = 3
    retry_base_seconds: float = 2.0
    max_html_bytes: int = 2_000_000
    max_image_bytes: int = 25_000_000
    max_image_pixels: int = 80_000_000
    max_redirects: int = 5
    respect_robots: bool = True
    fail_closed_robots: bool = True
    allow_private_hosts: bool = False
    stale_claim_seconds: int = 1800


@dataclass(frozen=True)
class AppConfig:
    schema_version: int
    run: RunConfig
    sources: tuple[SourceConfig, ...]
    models: tuple[ModelProfile, ...]


@dataclass(frozen=True)
class CrawlItem:
    item_id: int
    source_id: str
    url: str
    kind: ItemKind
    depth: int
    parent_url: str | None
    metadata: dict[str, Any]
    attempts: int


@dataclass(frozen=True)
class StoredAsset:
    sha256: str
    path: Path
    byte_length: int
    media_type: str
    image_format: str
    width: int
    height: int

    def to_json(self) -> dict[str, Any]:
        result = asdict(self)
        result["path"] = str(self.path)
        return result


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
