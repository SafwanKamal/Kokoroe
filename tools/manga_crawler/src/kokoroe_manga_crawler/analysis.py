from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .contracts import AnalysisError, CrawlItem, ModelProfile, RunConfig
from .security import endpoint_is_local


MAX_ANALYZER_RESPONSE_BYTES = 5_000_000


def _bbox(value: Any, path: str) -> list[int]:
    if (
        not isinstance(value, list)
        or len(value) != 4
        or any(not isinstance(item, int) or item < 0 for item in value)
    ):
        raise AnalysisError(f"{path} must be [x, y, width, height] integers")
    if value[2] == 0 or value[3] == 0:
        raise AnalysisError(f"{path} width and height must be positive")
    return value


def _validate_layout(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise AnalysisError("layout result must be an object")
    normalized: dict[str, Any] = {}
    for key in ("panels", "characters", "text_blocks"):
        values = result.get(key, [])
        if not isinstance(values, list):
            raise AnalysisError(f"layout.{key} must be an array")
        clean = []
        for index, value in enumerate(values):
            if not isinstance(value, dict):
                raise AnalysisError(f"layout.{key}[{index}] must be an object")
            item = {
                "id": str(value.get("id", f"{key}_{index}")),
                "bbox": _bbox(value.get("bbox"), f"layout.{key}[{index}].bbox"),
                "confidence": float(value.get("confidence", 0)),
            }
            if not 0 <= item["confidence"] <= 1:
                raise AnalysisError(
                    f"layout.{key}[{index}].confidence must be between 0 and 1"
                )
            if key == "text_blocks":
                item["text"] = str(value.get("text", ""))
                item["essential"] = bool(value.get("essential", True))
            clean.append(item)
        normalized[key] = clean
    reading_order = result.get("reading_order", [])
    speaker_links = result.get("speaker_links", [])
    if not isinstance(reading_order, list) or not all(
        isinstance(item, str) for item in reading_order
    ):
        raise AnalysisError("layout.reading_order must contain ids")
    if not isinstance(speaker_links, list):
        raise AnalysisError("layout.speaker_links must be an array")
    normalized["reading_order"] = reading_order
    normalized["speaker_links"] = speaker_links
    return normalized


PANEL_SPEC_FIELDS = {
    "spec_id",
    "should_generate",
    "reason",
    "story_beat",
    "characters",
    "setting",
    "action",
    "emotion",
    "camera",
    "composition",
    "time_and_lighting",
    "manga_effects",
    "continuity_facts",
    "exclusions",
    "confidence",
}


def _validate_panel_specs(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise AnalysisError("context result must be an object")
    specs = result.get("panel_specs")
    if not isinstance(specs, list):
        raise AnalysisError("context.panel_specs must be an array")
    normalized = []
    for index, raw in enumerate(specs):
        if not isinstance(raw, dict):
            raise AnalysisError(f"context.panel_specs[{index}] must be an object")
        unknown = set(raw) - PANEL_SPEC_FIELDS
        if unknown:
            raise AnalysisError(
                f"context.panel_specs[{index}] contains unsupported fields: "
                + ", ".join(sorted(unknown))
            )
        if not isinstance(raw.get("should_generate"), bool):
            raise AnalysisError(
                f"context.panel_specs[{index}].should_generate must be boolean"
            )
        confidence = float(raw.get("confidence", 0))
        if not 0 <= confidence <= 1:
            raise AnalysisError(
                f"context.panel_specs[{index}].confidence must be between 0 and 1"
            )
        clean = {key: raw[key] for key in PANEL_SPEC_FIELDS if key in raw}
        clean["spec_id"] = str(raw.get("spec_id", f"candidate_{index}"))
        clean["confidence"] = confidence
        for list_field in (
            "characters",
            "manga_effects",
            "continuity_facts",
            "exclusions",
        ):
            value = clean.get(list_field, [])
            if not isinstance(value, list) or not all(
                isinstance(item, (str, dict)) for item in value
            ):
                raise AnalysisError(
                    f"context.panel_specs[{index}].{list_field} must be an array"
                )
            clean[list_field] = value
        normalized.append(clean)
    return {"panel_specs": normalized}


def validate_result(task: str, result: Any) -> dict[str, Any]:
    if task == "manga-layout-transcription":
        return _validate_layout(result)
    if task == "manga-context-normalization":
        return _validate_panel_specs(result)
    if task == "manga-ocr":
        if not isinstance(result, dict) or not isinstance(
            result.get("text_blocks"), list
        ):
            raise AnalysisError("OCR result must contain text_blocks")
        return {"text_blocks": result["text_blocks"]}
    raise AnalysisError(f"unsupported analyzer task {task!r}")


def build_job(
    item: CrawlItem,
    profile: ModelProfile,
    prior_results: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "task": profile.task,
        "model_id": profile.model_id,
        "source": {
            "source_id": item.source_id,
            "url": item.url,
            "metadata": {
                key: value
                for key, value in item.metadata.items()
                if key not in {"local_path"}
            },
        },
        "asset": {
            "path": item.metadata["local_path"],
            "sha256": item.metadata["content_hash"],
        },
        "prior_results": prior_results,
    }


class AnalyzerRunner:
    def __init__(self, run: RunConfig):
        self.run_config = run

    def run(
        self,
        profile: ModelProfile,
        item: CrawlItem,
        prior_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        profile.validate_for(self.run_config.purpose)
        job = build_job(item, profile, prior_results)
        if profile.adapter == "command-json":
            result = self._run_command(profile, job)
        elif profile.adapter == "http-json":
            result = self._run_http(profile, job)
        elif profile.adapter == "manga-ocr":
            result = self._run_manga_ocr(profile, job)
        else:
            raise AnalysisError(f"unknown analyzer adapter {profile.adapter!r}")
        return validate_result(profile.task, result)

    def _run_command(
        self, profile: ModelProfile, job: dict[str, Any]
    ) -> dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="kokoroe-manga-analyzer-") as temp:
            temp_path = Path(temp)
            input_path = temp_path / "input.json"
            output_path = temp_path / "output.json"
            input_path.write_text(
                json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            command = [
                part.replace("{input_json}", str(input_path)).replace(
                    "{output_json}", str(output_path)
                )
                for part in profile.command
            ]
            if not any("{input_json}" in part for part in profile.command):
                raise AnalysisError(
                    f"{profile.profile_id}: command needs {{input_json}} placeholder"
                )
            if not any("{output_json}" in part for part in profile.command):
                raise AnalysisError(
                    f"{profile.profile_id}: command needs {{output_json}} placeholder"
                )
            try:
                completed = subprocess.run(
                    command,
                    shell=False,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=profile.timeout_seconds,
                    env=os.environ.copy(),
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                raise AnalysisError(
                    f"{profile.profile_id}: analyzer command failed: {exc}"
                ) from exc
            if completed.returncode != 0:
                stderr = completed.stderr[-2000:]
                raise AnalysisError(
                    f"{profile.profile_id}: analyzer exited "
                    f"{completed.returncode}: {stderr}"
                )
            if not output_path.exists():
                raise AnalysisError(
                    f"{profile.profile_id}: analyzer did not create output JSON"
                )
            if output_path.stat().st_size > MAX_ANALYZER_RESPONSE_BYTES:
                raise AnalysisError(
                    f"{profile.profile_id}: analyzer output is too large"
                )
            try:
                return json.loads(output_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise AnalysisError(
                    f"{profile.profile_id}: invalid analyzer JSON"
                ) from exc

    def _run_http(
        self, profile: ModelProfile, job: dict[str, Any]
    ) -> dict[str, Any]:
        assert profile.endpoint
        if not endpoint_is_local(profile.endpoint) and not profile.data_transfer_authorized:
            raise AnalysisError(
                f"{profile.profile_id}: remote data transfer is not authorized"
            )
        if profile.send_image_bytes:
            if not profile.data_transfer_authorized:
                raise AnalysisError(
                    f"{profile.profile_id}: sending image bytes requires "
                    "data_transfer_authorized"
                )
            asset_path = Path(job["asset"]["path"])
            if asset_path.stat().st_size > self.run_config.max_image_bytes:
                raise AnalysisError("analyzer image exceeds transfer byte limit")
            job["asset"]["base64"] = base64.b64encode(
                asset_path.read_bytes()
            ).decode("ascii")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": self.run_config.user_agent,
        }
        if profile.auth_token_env:
            token = os.environ.get(profile.auth_token_env)
            if not token:
                raise AnalysisError(
                    f"{profile.profile_id}: missing {profile.auth_token_env}"
                )
            headers["Authorization"] = f"Bearer {token}"
        request = Request(
            profile.endpoint,
            data=json.dumps(job, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=profile.timeout_seconds) as response:
                if response.headers.get_content_type() != "application/json":
                    raise AnalysisError(
                        f"{profile.profile_id}: endpoint did not return JSON"
                    )
                body = response.read(MAX_ANALYZER_RESPONSE_BYTES + 1)
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise AnalysisError(
                f"{profile.profile_id}: endpoint request failed: {exc}"
            ) from exc
        if len(body) > MAX_ANALYZER_RESPONSE_BYTES:
            raise AnalysisError(f"{profile.profile_id}: endpoint output is too large")
        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise AnalysisError(
                f"{profile.profile_id}: endpoint returned invalid JSON"
            ) from exc

    def _run_manga_ocr(
        self, profile: ModelProfile, job: dict[str, Any]
    ) -> dict[str, Any]:
        if profile.task != "manga-ocr":
            raise AnalysisError("manga-ocr adapter only supports manga-ocr task")
        try:
            from manga_ocr import MangaOcr
            from PIL import Image
        except ImportError as exc:
            raise AnalysisError(
                "install the crawler's 'ocr' extra to use manga-ocr"
            ) from exc
        text_regions: list[dict[str, Any]] = []
        for prior in job["prior_results"]:
            if prior["task"] == "manga-layout-transcription":
                text_regions = prior["result"].get("text_blocks", [])
        if not text_regions:
            raise AnalysisError(
                "manga-ocr requires text regions from a specialist layout model; "
                "whole-page OCR is intentionally disabled"
            )
        model = MangaOcr()
        results = []
        with Image.open(job["asset"]["path"]) as image:
            for region in text_regions:
                x, y, width, height = region["bbox"]
                crop = image.crop((x, y, x + width, y + height))
                results.append(
                    {
                        "id": region["id"],
                        "bbox": region["bbox"],
                        "text": model(crop),
                    }
                )
        return {"text_blocks": results}
