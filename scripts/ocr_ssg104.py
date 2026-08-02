from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "public" / "ssg104" / "source"
DEFAULT_OUTPUT_PATH = ROOT / "data" / "ssg104" / "ocr-rapidocr-raw.json"


def parse_slide_spec(value: str) -> list[int]:
    slides: set[int] = set()
    for chunk in value.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            start_text, end_text = chunk.split("-", 1)
            slides.update(range(int(start_text), int(end_text) + 1))
        else:
            slides.add(int(chunk))
    invalid = sorted(slide for slide in slides if not 9 <= slide <= 376)
    if invalid:
        raise argparse.ArgumentTypeError(f"Slides outside 9..376: {invalid}")
    return sorted(slides)


def ocr_lines(engine: RapidOCR, image: np.ndarray) -> list[dict[str, object]]:
    result, _ = engine(image)
    lines: list[dict[str, object]] = []
    for box, text, score in result or []:
        x = min(point[0] for point in box)
        y = min(point[1] for point in box)
        lines.append(
            {
                "text": text.strip(),
                "score": round(float(score), 6),
                "x": round(float(x), 2),
                "y": round(float(y), 2),
            }
        )
    return sorted(lines, key=lambda line: (line["y"], line["x"]))


def option_letters(lines: list[dict[str, object]]) -> list[str]:
    found: list[str] = []
    for line in lines:
        match = re.match(
            r"^\s*([A-F])(?:\s*[.)_:\-]\s*|\s+)",
            str(line["text"]),
            re.IGNORECASE,
        )
        if match:
            letter = match.group(1).upper()
            if letter not in found:
                found.append(letter)
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description="RapidOCR cross-check for SSG104 slides")
    parser.add_argument(
        "--slides",
        type=parse_slide_spec,
        default=list(range(9, 377)),
        help="Comma separated slides/ranges, for example 91,215,219,284",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output JSON path (relative paths are resolved from the project root)",
    )
    parser.add_argument(
        "--single-pass",
        action="store_true",
        help="Use the original image only; useful for fast full-bank cross-checking",
    )
    parser.add_argument(
        "--merge-input",
        action="append",
        default=[],
        type=Path,
        help="Merge one or more RapidOCR JSON files into --output, then exit",
    )
    args = parser.parse_args()
    selected: list[int] = args.slides
    output_path = args.output if args.output.is_absolute() else ROOT / args.output

    if args.merge_input:
        merged: dict[int, dict[str, object]] = {}
        input_paths = [output_path, *args.merge_input]
        for input_path in input_paths:
            resolved = input_path if input_path.is_absolute() else ROOT / input_path
            if not resolved.exists():
                continue
            for record in json.loads(resolved.read_text(encoding="utf-8")):
                merged[int(record["sourceSlide"])] = record
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps([merged[key] for key in sorted(merged)], ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        print(f"merged={len(merged)}")
        print(output_path)
        return

    existing: list[dict[str, object]] = []
    if output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
    by_slide = {int(record["sourceSlide"]): record for record in existing}
    engine = RapidOCR(det_db_box_thresh=0.25, det_db_thresh=0.18)

    for index, slide in enumerate(selected, start=1):
        path = IMAGE_ROOT / f"slide-{slide:04d}.png"
        if not path.exists():
            raise RuntimeError(f"Missing source image: {path}")
        image_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        cached = by_slide.get(slide)
        if cached and cached.get("sha256") == image_sha256:
            print(f"SSG104 {index}/{len(selected)} slide {slide} cached", flush=True)
            continue

        image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"Cannot decode {path}")
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        enlarged = cv2.resize(gray, None, fx=1.75, fy=1.75, interpolation=cv2.INTER_CUBIC)
        _, thresholded = cv2.threshold(enlarged, 225, 255, cv2.THRESH_BINARY)

        original_lines = ocr_lines(engine, image)
        thresholded_lines = [] if args.single_pass else ocr_lines(engine, thresholded)
        original_letters = option_letters(original_lines)
        thresholded_letters = option_letters(thresholded_lines)
        chosen_pass = (
            "thresholded"
            if len(thresholded_letters) > len(original_letters)
            else "original"
        )
        chosen_lines = (
            thresholded_lines if chosen_pass == "thresholded" else original_lines
        )

        with Image.open(path) as pil_image:
            image_format = pil_image.format

        by_slide[slide] = {
            "sourceSlide": slide,
            "image": f"/ssg104/source/{path.name}",
            "width": width,
            "height": height,
            "format": image_format,
            "sha256": image_sha256,
            "chosenPass": chosen_pass,
            "optionLetters": option_letters(chosen_lines),
            "chosenLines": chosen_lines,
            "passOriginal": original_lines,
            "passThresholded": thresholded_lines,
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(
                [by_slide[key] for key in sorted(by_slide)],
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"SSG104 {index}/{len(selected)} slide {slide}", flush=True)

    print(output_path)


if __name__ == "__main__":
    main()
