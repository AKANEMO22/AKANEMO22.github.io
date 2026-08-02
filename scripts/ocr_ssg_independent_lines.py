from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
WINDOWS_RAW = ROOT / "data" / "ssg104" / "ocr-windows-raw.json"
OUTPUT = ROOT / "data" / "ssg" / "audit" / "ocr-independent-rapid-lines.json"
NON_QUESTIONS = {20, 55, 63, 72, 83, 86, 90, 122, 148, 156, 216, 249, 288, 319, 332}


def crop_line(image: np.ndarray, words: list[dict[str, object]]) -> np.ndarray:
    x0 = max(0, int(min(float(word["x"]) for word in words)) - 6)
    y0 = max(0, int(min(float(word["y"]) for word in words)) - 5)
    x1 = min(
        image.shape[1],
        int(max(float(word["x"]) + float(word["width"]) for word in words)) + 7,
    )
    y1 = min(
        image.shape[0],
        int(max(float(word["y"]) + float(word["height"]) for word in words)) + 6,
    )
    return image[y0:y1, x0:x1]


def main() -> None:
    windows = json.loads(WINDOWS_RAW.read_text(encoding="utf-8-sig"))
    current: list[dict[str, object]] = []
    if OUTPUT.exists():
        current = json.loads(OUTPUT.read_text(encoding="utf-8"))
    by_slide = {int(record["sourceSlide"]): record for record in current}
    engine = RapidOCR(rec_batch_num=6)

    questions = [
        record for record in windows if int(record["sourceSlide"]) not in NON_QUESTIONS
    ]
    for index, record in enumerate(questions, start=1):
        slide = int(record["sourceSlide"])
        image_path = ROOT / "public" / "ssg104" / "source" / f"slide-{slide:04d}.png"
        image_sha256 = hashlib.sha256(image_path.read_bytes()).hexdigest()
        cached = by_slide.get(slide)
        if cached and cached.get("imageSha256") == image_sha256:
            print(f"SSG104 independent {index}/353 slide {slide} cached", flush=True)
            continue

        image = cv2.imdecode(
            np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR
        )
        if image is None:
            raise RuntimeError(f"Cannot decode {image_path}")

        source_lines = [line for line in record.get("lines", []) if line.get("words")]
        crops = [crop_line(image, line["words"]) for line in source_lines]
        recognized, _ = engine.text_rec(crops)
        lines: list[dict[str, object]] = []
        for source_line, result in zip(source_lines, recognized, strict=True):
            lines.append(
                {
                    "text": result[0],
                    "score": round(float(result[1]), 6),
                    "sourceBoxWords": source_line["words"],
                }
            )

        by_slide[slide] = {
            "sourceSlide": slide,
            "image": f"/ssg104/source/slide-{slide:04d}.png",
            "imageSha256": image_sha256,
            "engine": "RapidOCR recognition-only on PNG line crops",
            "lineCropSource": "Windows.Media.Ocr word bounding boxes only; text ignored",
            "lines": lines,
        }
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(
            json.dumps([by_slide[key] for key in sorted(by_slide)], ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        print(f"SSG104 independent {index}/353 slide {slide}", flush=True)

    print(OUTPUT)


if __name__ == "__main__":
    main()
