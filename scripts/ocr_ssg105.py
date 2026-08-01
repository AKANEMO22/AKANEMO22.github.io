from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "public" / "ssg105" / "source"
OUTPUT_ROOT = ROOT / "data" / "ssg105" / "ocr-raw"
OUTPUT_PATH = OUTPUT_ROOT / "rapidocr.json"
PARTIAL_PATH = OUTPUT_ROOT / "rapidocr.partial.json"


def slide_number(path: Path) -> int:
    return int(path.stem.split("-")[-1])


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
        match = re.match(r"^\s*([A-F])\s*[.)]", str(line["text"]), re.IGNORECASE)
        if match:
            letter = match.group(1).upper()
            if letter not in found:
                found.append(letter)
    return found


def main() -> None:
    images = sorted(IMAGE_ROOT.glob("slide-*.png"), key=slide_number)
    expected = list(range(378, 508))
    actual = [slide_number(path) for path in images]
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        raise RuntimeError(f"Expected slides 378-507; missing={missing}, extra={extra}")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output = (
        json.loads(PARTIAL_PATH.read_text(encoding="utf-8"))
        if PARTIAL_PATH.exists()
        else json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        if OUTPUT_PATH.exists()
        else []
    )
    engine = RapidOCR(det_db_box_thresh=0.25, det_db_thresh=0.18)

    for index, path in enumerate(images, start=1):
        slide = slide_number(path)
        image_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        if (
            index <= len(output)
            and output[index - 1].get("sourceSlide") == slide
            and output[index - 1].get("sha256") == image_sha256
        ):
            print(f"SSG105 {index:03d}/130 cached", flush=True)
            continue

        image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"Cannot decode {path}")
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        enlarged = cv2.resize(gray, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
        _, thresholded = cv2.threshold(enlarged, 225, 255, cv2.THRESH_BINARY)

        original_lines = ocr_lines(engine, image)
        thresholded_lines = ocr_lines(engine, thresholded)
        original_letters = option_letters(original_lines)
        thresholded_letters = option_letters(thresholded_lines)
        chosen_letters = (
            thresholded_letters
            if len(thresholded_letters) > len(original_letters)
            else original_letters
        )

        with Image.open(path) as pil_image:
            image_format = pil_image.format

        record = {
            "sourceSlide": slide,
            "image": f"/ssg105/source/{path.name}",
            "width": width,
            "height": height,
            "format": image_format,
            "sha256": image_sha256,
            "optionLetters": chosen_letters,
            "optionCount": len(chosen_letters),
            "passOriginal": original_lines,
            "passThresholded": thresholded_lines,
        }
        if index <= len(output):
            output[index - 1] = record
        else:
            output.append(record)
        PARTIAL_PATH.write_text(
            json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"SSG105 {index:03d}/130", flush=True)

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    PARTIAL_PATH.unlink(missing_ok=True)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
