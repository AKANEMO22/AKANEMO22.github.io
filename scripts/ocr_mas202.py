from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
EXAMS_ROOT = ROOT / "public" / "mas202" / "exams"
RAW_ROOT = ROOT / "data" / "mas202" / "ocr-raw"


def question_number(path: Path) -> int:
    return int(path.stem[1:])


def ocr_lines(engine: RapidOCR, image) -> list[dict[str, object]]:
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


def process_exam(exam: str) -> Path:
    image_dir = EXAMS_ROOT / exam / "images"
    files = sorted(image_dir.glob("Q*.*"), key=question_number)
    if len(files) != 50:
        raise RuntimeError(f"{exam}: expected 50 images, found {len(files)}")

    engine = RapidOCR(det_db_box_thresh=0.3, det_db_thresh=0.2)
    RAW_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = RAW_ROOT / f"{exam}.json"
    partial_path = RAW_ROOT / f"{exam}.partial.json"
    output = (
        json.loads(partial_path.read_text(encoding="utf-8"))
        if partial_path.exists()
        else []
    )

    for index, path in enumerate(files, start=1):
        if index <= len(output):
            print(f"{exam}: {index:02d}/50 cached", flush=True)
            continue

        image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError(f"Cannot decode {path}")
        height, width = image.shape[:2]

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        enlarged = cv2.resize(
            gray,
            None,
            fx=1.5,
            fy=1.5,
            interpolation=cv2.INTER_CUBIC,
        )
        _, thresholded = cv2.threshold(enlarged, 220, 255, cv2.THRESH_BINARY)

        with Image.open(path) as pil_image:
            image_format = pil_image.format

        output.append(
            {
                "question": index,
                "image": f"/mas202/exams/{exam}/images/{path.name}",
                "width": width,
                "height": height,
                "format": image_format,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "pass_original": ocr_lines(engine, image),
                "pass_thresholded": ocr_lines(engine, thresholded),
            }
        )
        partial_path.write_text(
            json.dumps(output, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"{exam}: {index:02d}/50", flush=True)

    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    partial_path.unlink(missing_ok=True)
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("exam", help="MAS202 exam directory name")
    args = parser.parse_args()
    print(process_exam(args.exam))
    return 0


if __name__ == "__main__":
    sys.exit(main())
