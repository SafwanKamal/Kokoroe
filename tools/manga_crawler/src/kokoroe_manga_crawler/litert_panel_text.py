from __future__ import annotations

import argparse
import hashlib
import hmac
import json
from pathlib import Path
import re
from typing import Any, Iterable


INPUT_SIZE = 640
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


def verify_model_sha256(model_path: Path, expected_sha256: str) -> None:
    if not SHA256_PATTERN.fullmatch(expected_sha256):
        raise ValueError("expected model SHA-256 must be 64 lowercase hex characters")
    digest = hashlib.sha256()
    with model_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if not hmac.compare_digest(digest.hexdigest(), expected_sha256):
        raise ValueError("model artifact SHA-256 does not match the pinned digest")


def _page_bbox(
    detection: Iterable[float],
    *,
    image_width: int,
    image_height: int,
    scale: float,
    pad_left: int,
    pad_top: int,
) -> list[int] | None:
    x1, y1, x2, y2 = list(detection)[:4]
    input_x1 = float(x1) * INPUT_SIZE
    input_y1 = float(y1) * INPUT_SIZE
    input_x2 = float(x2) * INPUT_SIZE
    input_y2 = float(y2) * INPUT_SIZE
    page_x1 = max(0, min(image_width, round((input_x1 - pad_left) / scale)))
    page_y1 = max(0, min(image_height, round((input_y1 - pad_top) / scale)))
    page_x2 = max(0, min(image_width, round((input_x2 - pad_left) / scale)))
    page_y2 = max(0, min(image_height, round((input_y2 - pad_top) / scale)))
    if page_x2 <= page_x1 or page_y2 <= page_y1:
        return None
    return [page_x1, page_y1, page_x2 - page_x1, page_y2 - page_y1]


def convert_detections(
    detections: Iterable[Iterable[float]],
    *,
    image_width: int,
    image_height: int,
    scale: float,
    pad_left: int,
    pad_top: int,
    confidence_threshold: float,
) -> dict[str, Any]:
    panels: list[dict[str, Any]] = []
    text_blocks: list[dict[str, Any]] = []
    for detection in detections:
        values = list(detection)
        if len(values) != 6:
            raise ValueError("each detector row must contain six values")
        confidence = float(values[4])
        if confidence < confidence_threshold:
            continue
        class_id = int(values[5])
        bbox = _page_bbox(
            values,
            image_width=image_width,
            image_height=image_height,
            scale=scale,
            pad_left=pad_left,
            pad_top=pad_top,
        )
        if bbox is None:
            continue
        if class_id == 0:
            panels.append(
                {
                    "id": f"panel_{len(panels)}",
                    "bbox": bbox,
                    "confidence": confidence,
                }
            )
        elif class_id == 1:
            text_blocks.append(
                {
                    "id": f"text_{len(text_blocks)}",
                    "bbox": bbox,
                    "confidence": confidence,
                    "text": "",
                    "essential": True,
                }
            )
    return {
        "panels": panels,
        "characters": [],
        "text_blocks": text_blocks,
        "reading_order": [],
        "speaker_links": [],
    }


def analyze(
    job: dict[str, Any],
    model_path: Path,
    model_sha256: str,
    threshold: float,
) -> dict[str, Any]:
    if job.get("task") != "manga-layout-transcription":
        raise ValueError("this wrapper only supports manga-layout-transcription")
    if not 0 <= threshold <= 1:
        raise ValueError("confidence threshold must be between zero and one")
    asset_path = Path(job["asset"]["path"])
    if not asset_path.is_file():
        raise ValueError("job asset path does not exist")
    if not model_path.is_file():
        raise ValueError("model path does not exist")
    verify_model_sha256(model_path, model_sha256)

    try:
        import numpy as np
        from ai_edge_litert.interpreter import Interpreter
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "install the crawler's 'layout' extra in a dedicated model environment"
        ) from exc

    with Image.open(asset_path) as source:
        image = source.convert("RGB")
        image_width, image_height = image.size
        scale = min(INPUT_SIZE / image_width, INPUT_SIZE / image_height)
        resized_width = round(image_width * scale)
        resized_height = round(image_height * scale)
        resized = image.resize(
            (resized_width, resized_height), Image.Resampling.BILINEAR
        )
        pad_left = (INPUT_SIZE - resized_width) // 2
        pad_top = (INPUT_SIZE - resized_height) // 2
        model_input = Image.new(
            "RGB", (INPUT_SIZE, INPUT_SIZE), color=(114, 114, 114)
        )
        model_input.paste(resized, (pad_left, pad_top))
        input_tensor = (
            np.asarray(model_input, dtype=np.float32)[np.newaxis, ...] / 255.0
        )

    interpreter = Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    inputs = interpreter.get_input_details()
    outputs = interpreter.get_output_details()
    if len(inputs) != 1 or tuple(inputs[0]["shape"]) != (1, 640, 640, 3):
        raise ValueError("unexpected detector input tensor")
    if len(outputs) != 1 or tuple(outputs[0]["shape"]) != (1, 300, 6):
        raise ValueError("unexpected detector output tensor")
    interpreter.set_tensor(inputs[0]["index"], input_tensor)
    interpreter.invoke()
    detections = interpreter.get_tensor(outputs[0]["index"])[0]
    return convert_detections(
        detections,
        image_width=image_width,
        image_height=image_height,
        scale=scale,
        pad_left=pad_left,
        pad_top=pad_top,
        confidence_threshold=threshold,
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the pinned Manga109-s panel/text TFLite detector."
    )
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--model-sha256", required=True)
    parser.add_argument("--threshold", type=float, default=0.25)
    return parser


def main() -> None:
    args = _parser().parse_args()
    job = json.loads(args.input.read_text(encoding="utf-8"))
    result = analyze(job, args.model, args.model_sha256, args.threshold)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
