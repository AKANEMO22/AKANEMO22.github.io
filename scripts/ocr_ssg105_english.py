from __future__ import annotations

import hashlib
import json
from difflib import SequenceMatcher
from pathlib import Path

import cv2
import numpy as np
from rapidocr import RapidOCR
from rapidocr.utils.parse_parameters import LangRec, ModelType, OCRVersion


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "public" / "ssg105" / "source"
NATIVE_ROOT = ROOT / ".tmp-ssg105-native"
OUTPUT_PATH = ROOT / "data" / "ssg105" / "ocr-raw" / "english.json"
PARTIAL_PATH = OUTPUT_PATH.with_suffix(".partial.json")


def normalized(value: str) -> str:
    return " ".join(value.split()).strip()


def ocr_lines(engine: RapidOCR, image, source_width: int, source_height: int) -> list[dict]:
    result = engine(image)
    boxes = result.boxes if result is not None else None
    texts = result.txts if result is not None else None
    scores = result.scores if result is not None else None
    if boxes is None or texts is None or scores is None:
        return []

    height, width = image.shape[:2]
    return [
        {
            "text": normalized(text),
            "score": round(float(score), 6),
            "x": round(float(min(point[0] for point in box)) * source_width / width, 2),
            "y": round(float(min(point[1] for point in box)) * source_height / height, 2),
        }
        for box, text, score in zip(boxes, texts, scores)
        if normalized(text)
    ]


def merge_passes(passes: list[list[dict]]) -> list[dict]:
    rows: list[list[dict]] = []
    for line in sorted((line for current in passes for line in current), key=lambda item: (item["y"], item["x"])):
        row = next((candidate for candidate in rows if abs(candidate[0]["y"] - line["y"]) <= 7), None)
        if row is None:
            rows.append([line])
        else:
            row.append(line)

    selected = []
    for row in rows:
        best = max(row, key=lambda item: (len(item["text"]) * item["score"], item["score"]))
        selected.append(best)

    deduped: list[dict] = []
    for line in sorted(selected, key=lambda item: (item["y"], item["x"])):
        duplicate_index = next(
            (
                index
                for index, current in enumerate(deduped)
                if abs(current["y"] - line["y"]) <= 16
                and SequenceMatcher(None, current["text"].lower(), line["text"].lower()).ratio() >= 0.88
            ),
            None,
        )
        if duplicate_index is None:
            deduped.append(line)
        elif len(line["text"]) * line["score"] > len(deduped[duplicate_index]["text"]) * deduped[duplicate_index]["score"]:
            deduped[duplicate_index] = line
    return sorted(deduped, key=lambda item: (item["y"], item["x"]))


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cached = []
    if PARTIAL_PATH.exists():
        cached = json.loads(PARTIAL_PATH.read_text(encoding="utf-8-sig"))
    elif OUTPUT_PATH.exists():
        cached = json.loads(OUTPUT_PATH.read_text(encoding="utf-8-sig"))

    engine = RapidOCR(
        params={
            "Rec.lang_type": LangRec.EN,
            "Rec.ocr_version": OCRVersion.PPOCRV5,
            "Rec.model_type": ModelType.MOBILE,
            "Det.limit_side_len": 1280,
            "Det.limit_type": "max",
            "Det.box_thresh": 0.2,
            "Det.thresh": 0.12,
            "Global.log_level": "warning",
        }
    )

    output: list[dict] = list(cached)
    for slide in range(378, 508):
        index = slide - 378
        name = f"slide-{slide:04d}.png"
        public_path = PUBLIC_ROOT / name
        native_path = NATIVE_ROOT / name
        image_hash = hashlib.sha256(public_path.read_bytes()).hexdigest()
        if index < len(output) and output[index].get("sha256") == image_hash:
            print(f"SSG105 English {index + 1:03d}/130 cached", flush=True)
            continue

        public = cv2.imdecode(np.fromfile(public_path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if public is None:
            raise RuntimeError(f"Cannot decode {public_path}")
        height, width = public.shape[:2]
        passes = [ocr_lines(engine, public, width, height)]
        passes.append(ocr_lines(engine, public[: int(height * 0.30), :], width, height))

        if native_path.exists():
            native = cv2.imdecode(np.fromfile(native_path, dtype=np.uint8), cv2.IMREAD_COLOR)
            if native is not None:
                passes.append(ocr_lines(engine, native, width, height))

        record = {
            "sourceSlide": slide,
            "image": f"/ssg105/source/{name}",
            "sha256": image_hash,
            "engine": "RapidOCR PP-OCRv5 English mobile; public + top crop + native merge",
            "passes": passes,
            "lines": merge_passes(passes),
        }
        if index < len(output):
            output[index] = record
        else:
            output.append(record)
        if (index + 1) % 10 == 0:
            PARTIAL_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"SSG105 English {index + 1:03d}/130", flush=True)

    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PARTIAL_PATH.unlink(missing_ok=True)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
