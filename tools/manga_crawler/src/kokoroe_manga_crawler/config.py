from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .contracts import (
    AppConfig,
    AssetSeed,
    ConfigurationError,
    DiscoveryConfig,
    LocalImportConfig,
    ModelProfile,
    RightsBasis,
    RightsRecord,
    RunConfig,
    SourceConfig,
)


def _require_mapping(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigurationError(f"{path} must be an object")
    return value


def _require_list(value: Any, path: str) -> list[Any]:
    if not isinstance(value, list):
        raise ConfigurationError(f"{path} must be an array")
    return value


def _text(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigurationError(f"{path} must be a non-empty string")
    return value.strip()


def _string_tuple(value: Any, path: str, *, nonempty: bool = False) -> tuple[str, ...]:
    items = tuple(_text(item, f"{path}[]") for item in _require_list(value, path))
    if nonempty and not items:
        raise ConfigurationError(f"{path} must not be empty")
    return items


def _url(value: Any, path: str) -> str:
    text = _text(value, path)
    parsed = urlsplit(text)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ConfigurationError(f"{path} must be an absolute HTTP(S) URL")
    if parsed.username or parsed.password:
        raise ConfigurationError(f"{path} must not include URL credentials")
    return text


def _parse_rights(raw: Any, path: str) -> RightsRecord:
    obj = _require_mapping(raw, path)
    try:
        basis = RightsBasis(_text(obj.get("basis"), f"{path}.basis"))
    except ValueError as exc:
        allowed = ", ".join(item.value for item in RightsBasis)
        raise ConfigurationError(f"{path}.basis must be one of: {allowed}") from exc
    return RightsRecord(
        authorization_id=_text(
            obj.get("authorization_id"), f"{path}.authorization_id"
        ),
        basis=basis,
        evidence=_text(obj.get("evidence"), f"{path}.evidence"),
        permitted_purposes=_string_tuple(
            obj.get("permitted_purposes"), f"{path}.permitted_purposes", nonempty=True
        ),
        redistribution_allowed=bool(obj.get("redistribution_allowed", False)),
        expires_at=obj.get("expires_at"),
        notes=str(obj.get("notes", "")),
    )


def _parse_asset(raw: Any, path: str) -> AssetSeed:
    obj = _require_mapping(raw, path)
    page_index = obj.get("page_index")
    if not isinstance(page_index, int) or page_index < 0:
        raise ConfigurationError(f"{path}.page_index must be a non-negative integer")
    return AssetSeed(
        url=_url(obj.get("url"), f"{path}.url"),
        work_id=_text(obj.get("work_id"), f"{path}.work_id"),
        scene_id=_text(obj.get("scene_id"), f"{path}.scene_id"),
        page_index=page_index,
        chapter_id=obj.get("chapter_id"),
        context_before=_string_tuple(
            obj.get("context_before", []), f"{path}.context_before"
        ),
        character_hints=_string_tuple(
            obj.get("character_hints", []), f"{path}.character_hints"
        ),
    )


def _parse_discovery(raw: Any, path: str) -> DiscoveryConfig:
    obj = _require_mapping(raw, path)
    mode = _text(obj.get("mode"), f"{path}.mode")
    if mode != "html":
        raise ConfigurationError(f"{path}.mode currently supports only 'html'")
    page_pattern = _text(obj.get("page_link_regex"), f"{path}.page_link_regex")
    image_pattern = _text(obj.get("image_url_regex"), f"{path}.image_url_regex")
    try:
        re.compile(page_pattern)
        re.compile(image_pattern)
    except re.error as exc:
        raise ConfigurationError(f"{path} contains an invalid regular expression") from exc
    max_depth = obj.get("max_depth", 1)
    max_urls = obj.get("max_urls", 100)
    if not isinstance(max_depth, int) or not 0 <= max_depth <= 10:
        raise ConfigurationError(f"{path}.max_depth must be between 0 and 10")
    if not isinstance(max_urls, int) or not 1 <= max_urls <= 100_000:
        raise ConfigurationError(f"{path}.max_urls must be between 1 and 100000")
    return DiscoveryConfig(
        mode=mode,
        seed_urls=tuple(
            _url(item, f"{path}.seed_urls[]")
            for item in _require_list(obj.get("seed_urls"), f"{path}.seed_urls")
        ),
        page_link_regex=page_pattern,
        image_url_regex=image_pattern,
        max_depth=max_depth,
        max_urls=max_urls,
    )


def _parse_local_import(
    raw: Any, path: str, config_dir: Path
) -> LocalImportConfig:
    obj = _require_mapping(raw, path)
    roots = []
    for index, value in enumerate(
        _require_list(obj.get("allowed_roots"), f"{path}.allowed_roots")
    ):
        root = Path(_text(value, f"{path}.allowed_roots[{index}]"))
        if not root.is_absolute():
            root = config_dir / root
        roots.append(root.resolve())
    if not roots:
        raise ConfigurationError(f"{path}.allowed_roots must not be empty")
    max_files = obj.get("max_files", 1_000)
    if not isinstance(max_files, int) or not 1 <= max_files <= 100_000:
        raise ConfigurationError(f"{path}.max_files must be between 1 and 100000")
    return LocalImportConfig(allowed_roots=tuple(roots), max_files=max_files)


def _parse_source(raw: Any, path: str, config_dir: Path) -> SourceConfig:
    obj = _require_mapping(raw, path)
    domains = tuple(
        item.lower()
        for item in _string_tuple(
            obj.get("allowed_domains", []), f"{path}.allowed_domains"
        )
    )
    for domain in domains:
        if "/" in domain or ":" in domain:
            raise ConfigurationError(
                f"{path}.allowed_domains entries must be bare hostnames"
            )
    prefixes = _string_tuple(
        obj.get("allowed_path_prefixes", ["/"]),
        f"{path}.allowed_path_prefixes",
        nonempty=True,
    )
    if any(not prefix.startswith("/") for prefix in prefixes):
        raise ConfigurationError(
            f"{path}.allowed_path_prefixes entries must begin with '/'"
        )
    assets = tuple(
        _parse_asset(item, f"{path}.assets[{index}]")
        for index, item in enumerate(
            _require_list(obj.get("assets", []), f"{path}.assets")
        )
    )
    discovery_raw = obj.get("discovery")
    discovery = (
        _parse_discovery(discovery_raw, f"{path}.discovery")
        if discovery_raw is not None
        else None
    )
    local_raw = obj.get("local_import")
    local_import = (
        _parse_local_import(local_raw, f"{path}.local_import", config_dir)
        if local_raw is not None
        else None
    )
    if not assets and discovery is None and local_import is None:
        raise ConfigurationError(f"{path} needs assets, discovery, or local_import")
    if (assets or discovery is not None) and not domains:
        raise ConfigurationError(
            f"{path}.allowed_domains must not be empty for network sources"
        )
    delay = obj.get("delay_seconds", 2.0)
    if not isinstance(delay, (int, float)) or not 0 <= float(delay) <= 3600:
        raise ConfigurationError(f"{path}.delay_seconds must be between 0 and 3600")
    return SourceConfig(
        source_id=_text(obj.get("source_id"), f"{path}.source_id"),
        enabled=bool(obj.get("enabled", True)),
        rights=_parse_rights(obj.get("rights"), f"{path}.rights"),
        allowed_domains=domains,
        allowed_path_prefixes=prefixes,
        delay_seconds=float(delay),
        assets=assets,
        discovery=discovery,
        local_import=local_import,
    )


def _parse_model(raw: Any, path: str) -> ModelProfile:
    obj = _require_mapping(raw, path)
    adapter = _text(obj.get("adapter"), f"{path}.adapter")
    if adapter not in {"command-json", "http-json", "manga-ocr"}:
        raise ConfigurationError(
            f"{path}.adapter must be command-json, http-json, or manga-ocr"
        )
    command = _string_tuple(obj.get("command", []), f"{path}.command")
    endpoint = obj.get("endpoint")
    if adapter == "command-json" and not command:
        raise ConfigurationError(f"{path}.command is required")
    if adapter == "http-json":
        endpoint = _url(endpoint, f"{path}.endpoint")
    timeout = obj.get("timeout_seconds", 180.0)
    if not isinstance(timeout, (int, float)) or not 1 <= float(timeout) <= 3600:
        raise ConfigurationError(f"{path}.timeout_seconds must be between 1 and 3600")
    known = {
        "profile_id",
        "enabled",
        "adapter",
        "task",
        "model_id",
        "tuned_for",
        "license",
        "allowed_purposes",
        "general_purpose",
        "command",
        "endpoint",
        "auth_token_env",
        "timeout_seconds",
        "send_image_bytes",
        "data_transfer_authorized",
    }
    return ModelProfile(
        profile_id=_text(obj.get("profile_id"), f"{path}.profile_id"),
        enabled=bool(obj.get("enabled", True)),
        adapter=adapter,
        task=_text(obj.get("task"), f"{path}.task"),
        model_id=_text(obj.get("model_id"), f"{path}.model_id"),
        tuned_for=_string_tuple(
            obj.get("tuned_for"), f"{path}.tuned_for", nonempty=True
        ),
        license=_text(obj.get("license"), f"{path}.license"),
        allowed_purposes=_string_tuple(
            obj.get("allowed_purposes"), f"{path}.allowed_purposes", nonempty=True
        ),
        general_purpose=bool(obj.get("general_purpose", False)),
        command=command,
        endpoint=endpoint,
        auth_token_env=obj.get("auth_token_env"),
        timeout_seconds=float(timeout),
        send_image_bytes=bool(obj.get("send_image_bytes", False)),
        data_transfer_authorized=bool(
            obj.get("data_transfer_authorized", False)
        ),
        extra={key: value for key, value in obj.items() if key not in known},
    )


def load_config(path: Path) -> AppConfig:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"cannot load config {path}: {exc}") from exc
    obj = _require_mapping(raw, "config")
    if obj.get("schema_version") != 1:
        raise ConfigurationError("config.schema_version must be 1")
    run_raw = _require_mapping(obj.get("run"), "config.run")
    output_raw = _text(run_raw.get("output_dir"), "config.run.output_dir")
    output_dir = Path(output_raw)
    if not output_dir.is_absolute():
        output_dir = (path.parent / output_dir).resolve()
    run = RunConfig(
        output_dir=output_dir,
        purpose=_text(run_raw.get("purpose"), "config.run.purpose"),
        user_agent=_text(run_raw.get("user_agent"), "config.run.user_agent"),
        contact=_text(run_raw.get("contact"), "config.run.contact"),
        request_timeout_seconds=float(run_raw.get("request_timeout_seconds", 30)),
        max_retries=int(run_raw.get("max_retries", 3)),
        retry_base_seconds=float(run_raw.get("retry_base_seconds", 2)),
        max_html_bytes=int(run_raw.get("max_html_bytes", 2_000_000)),
        max_image_bytes=int(run_raw.get("max_image_bytes", 25_000_000)),
        max_image_pixels=int(run_raw.get("max_image_pixels", 80_000_000)),
        max_redirects=int(run_raw.get("max_redirects", 5)),
        respect_robots=bool(run_raw.get("respect_robots", True)),
        fail_closed_robots=bool(run_raw.get("fail_closed_robots", True)),
        allow_private_hosts=bool(run_raw.get("allow_private_hosts", False)),
        stale_claim_seconds=int(run_raw.get("stale_claim_seconds", 1800)),
    )
    if run.max_retries < 0 or run.max_retries > 20:
        raise ConfigurationError("config.run.max_retries must be between 0 and 20")
    if not 1 <= run.max_redirects <= 20:
        raise ConfigurationError("config.run.max_redirects must be between 1 and 20")
    if run.max_html_bytes <= 0 or run.max_image_bytes <= 0:
        raise ConfigurationError("config.run byte limits must be positive")
    if run.max_image_pixels <= 0:
        raise ConfigurationError("config.run.max_image_pixels must be positive")
    if run.request_timeout_seconds <= 0:
        raise ConfigurationError(
            "config.run.request_timeout_seconds must be positive"
        )
    sources = tuple(
        _parse_source(item, f"config.sources[{index}]", path.parent.resolve())
        for index, item in enumerate(
            _require_list(obj.get("sources"), "config.sources")
        )
    )
    models = tuple(
        _parse_model(item, f"config.models[{index}]")
        for index, item in enumerate(
            _require_list(obj.get("models", []), "config.models")
        )
    )
    source_ids = [source.source_id for source in sources]
    model_ids = [model.profile_id for model in models]
    if len(source_ids) != len(set(source_ids)):
        raise ConfigurationError("config.sources contains duplicate source_id values")
    if len(model_ids) != len(set(model_ids)):
        raise ConfigurationError("config.models contains duplicate profile_id values")
    for source in sources:
        if source.enabled:
            source.rights.validate_for(run.purpose)
    for model in models:
        if model.enabled:
            model.validate_for(run.purpose)
    enabled_tasks = [model.task for model in models if model.enabled]
    if "manga-ocr" in enabled_tasks and (
        "manga-layout-transcription" not in enabled_tasks
        or enabled_tasks.index("manga-layout-transcription")
        > enabled_tasks.index("manga-ocr")
    ):
        raise ConfigurationError(
            "enabled manga-ocr requires an earlier manga-layout-transcription profile"
        )
    if "manga-context-normalization" in enabled_tasks and (
        "manga-layout-transcription" not in enabled_tasks
        or enabled_tasks.index("manga-layout-transcription")
        > enabled_tasks.index("manga-context-normalization")
    ):
        raise ConfigurationError(
            "enabled manga-context-normalization requires an earlier "
            "manga-layout-transcription profile"
        )
    return AppConfig(schema_version=1, run=run, sources=sources, models=models)
