from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WINDOWS_PATH = ROOT / "data" / "ssg104" / "ocr-windows-raw.json"
RAPID_PATH = ROOT / "data" / "ssg104" / "ocr-rapidocr-raw.json"
OUTPUT_PATH = ROOT / "data" / "ssg104" / "ocr-combined.json"

# These are logo/divider slides in the source deck, not questions.  Keeping them
# in the OCR artifact makes the 9..376 source-slide audit explicit.
NON_QUESTION_SLIDES = {
    20,
    55,
    63,
    72,
    83,
    86,
    90,
    122,
    148,
    156,
    216,
    249,
    288,
    319,
    332,
}

LABEL_RE = re.compile(r"^\s*([A-F])(?:\s*[.)_:\-]\s*|\s+|$)(.*)$", re.IGNORECASE)
LEADING_NUMBER_RE = re.compile(r"^\s*\d+\s*[.)]\s*")
LOGO_RE = re.compile(
    r"^\s*(?::?\s*(?:F\s*)?O\s*R\s*U|F\s*P\s*T\s*E?D?U?|HO[\w\s]*HO[\w\s]*)\s*$",
    re.IGNORECASE,
)


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\ufeff", " ")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+Ho(?:a|ä)ng\s+Ho(?:a|ä)ng\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"(?:^|\s+)(?:[-:]\s*)?(?:F\s*)?O\s*R\s*U\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"(?:^|\s+)DRU\s*$", "", value, flags=re.IGNORECASE)
    return value.strip()


def is_artifact(value: str) -> bool:
    value = clean_text(value)
    return not value or bool(LOGO_RE.fullmatch(value))


def line_candidates(lines: list[str]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for index, text in enumerate(lines):
        match = LABEL_RE.match(text)
        if not match:
            continue
        candidates.append(
            {
                "index": index,
                "letter": match.group(1).upper(),
                "text": clean_text(match.group(2)),
            }
        )
    return candidates


def choose_option_markers(lines: list[str]) -> list[dict[str, Any]]:
    """Choose the best A..F chain while avoiding stems such as 'A student...'."""

    candidates = line_candidates(lines)
    starts = [candidate for candidate in candidates if candidate["letter"] == "A"]
    best: list[dict[str, Any]] = []
    best_key = (-1, -1, -1)

    for start in starts:
        chain = [start]
        cursor = start["index"]
        for letter in "BCDEF":
            choices = [
                candidate
                for candidate in candidates
                if candidate["letter"] == letter and candidate["index"] > cursor
            ]
            if not choices:
                break
            selected = choices[0]
            chain.append(selected)
            cursor = selected["index"]

        # Prefer more consecutive labels, then an A which follows real question
        # text, then the later A (important for stems beginning with "A ...").
        question_chars = len(" ".join(lines[: start["index"]]))
        key = (len(chain), int(question_chars >= 8), start["index"])
        if key > best_key:
            best = chain
            best_key = key

    if len(best) >= 2:
        return best

    # A label can occasionally be lost.  Preserve a partial B.. chain for the
    # audit instead of manufacturing text.
    for first_letter in "BCD":
        starts = [candidate for candidate in candidates if candidate["letter"] == first_letter]
        for start in starts:
            chain = [start]
            cursor = start["index"]
            for letter in "ABCDEF"["ABCDEF".index(first_letter) + 1 :]:
                choices = [
                    candidate
                    for candidate in candidates
                    if candidate["letter"] == letter and candidate["index"] > cursor
                ]
                if not choices:
                    break
                selected = choices[0]
                chain.append(selected)
                cursor = selected["index"]
            if len(chain) > len(best):
                best = chain
    return best


def parse_lines(raw_lines: list[str]) -> dict[str, Any]:
    lines = [clean_text(line) for line in raw_lines]
    lines = [line for line in lines if line]
    markers = choose_option_markers(lines)
    if not markers:
        question_lines = [line for line in lines if not is_artifact(line)]
        question = clean_text(" ".join(question_lines))
        return {"questionText": LEADING_NUMBER_RE.sub("", question), "options": []}

    question_lines = [line for line in lines[: markers[0]["index"]] if not is_artifact(line)]
    question = LEADING_NUMBER_RE.sub("", clean_text(" ".join(question_lines)))
    options: list[dict[str, str]] = []
    for marker_index, marker in enumerate(markers):
        end = markers[marker_index + 1]["index"] if marker_index + 1 < len(markers) else len(lines)
        chunks = [marker["text"]]
        chunks.extend(
            line
            for line in lines[marker["index"] + 1 : end]
            if not is_artifact(line)
        )
        options.append(
            {
                "letter": marker["letter"],
                "text": clean_text(" ".join(chunk for chunk in chunks if chunk)),
            }
        )
    return {"questionText": question, "options": options}


def spatially_order_windows_lines(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Restore reading order when Windows OCR splits one row into two lines."""

    positioned: list[tuple[float, float, dict[str, Any]]] = []
    for line in lines:
        words = line.get("words", [])
        y = min((float(word.get("y", 0)) for word in words), default=0)
        x = min((float(word.get("x", 0)) for word in words), default=0)
        positioned.append((y, x, line))
    positioned.sort(key=lambda item: (item[0], item[1]))

    rows: list[list[tuple[float, float, dict[str, Any]]]] = []
    row_y_values: list[float] = []
    for item in positioned:
        y = item[0]
        if rows and abs(y - row_y_values[-1]) <= 7:
            rows[-1].append(item)
            row_y_values[-1] = min(row_y_values[-1], y)
        else:
            rows.append([item])
            row_y_values.append(y)
    return [item[2] for row in rows for item in sorted(row, key=lambda item: item[1])]


def record_score(parsed: dict[str, Any]) -> int:
    question = parsed["questionText"]
    options = parsed["options"]
    labels = [option["letter"] for option in options]
    score = min(len(question), 80)
    score += len(options) * 35
    score += sum(min(len(option["text"]), 30) for option in options)
    if labels[:4] == list("ABCD"):
        score += 100
    if any(not option["text"] for option in options):
        score -= 100
    return score


def make_record(raw: dict[str, Any], parsed: dict[str, Any], engine: str) -> dict[str, Any]:
    slide = int(raw["sourceSlide"])
    is_question = slide not in NON_QUESTION_SLIDES
    question = parsed["questionText"] if is_question else ""
    options = parsed["options"] if is_question else []
    labels = [option["letter"] for option in options]
    flags: list[str] = []
    if not is_question:
        flags.append("source-divider-not-question")
    else:
        if len(question) < 8:
            flags.append("missing-or-short-question")
        if labels[:4] != list("ABCD"):
            flags.append("missing-standard-option-labels")
        if len(options) < 4:
            flags.append("fewer-than-four-options")
        if any(len(option["text"]) < 1 for option in options):
            flags.append("empty-option-text")
        if any(is_artifact(option["text"]) for option in options):
            flags.append("possible-logo-artifact")

    if not is_question:
        confidence = "not-applicable"
    elif not flags:
        confidence = "high"
    elif question and len(options) >= 3 and all(option["text"] for option in options):
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "sourceSlide": slide,
        "image": raw["image"],
        "isQuestion": is_question,
        "questionText": question,
        "options": options,
        "detectedOptionLabels": labels,
        "optionCount": len(options),
        "confidence": confidence,
        "flags": flags,
        "selectedEngine": engine,
        "crossCheck": {
            "windowsScore": None,
            "rapidOcrScore": None,
            "enginesAgreeOnLabels": None,
        },
    }


def main() -> None:
    windows = json.loads(WINDOWS_PATH.read_text(encoding="utf-8-sig"))
    if [int(record["sourceSlide"]) for record in windows] != list(range(9, 377)):
        raise RuntimeError("Windows OCR input must contain exactly source slides 9..376")

    rapid_by_slide: dict[int, dict[str, Any]] = {}
    if RAPID_PATH.exists():
        rapid = json.loads(RAPID_PATH.read_text(encoding="utf-8"))
        rapid_by_slide = {int(record["sourceSlide"]): record for record in rapid}

    output: list[dict[str, Any]] = []
    for raw in windows:
        slide = int(raw["sourceSlide"])
        windows_lines = spatially_order_windows_lines(raw.get("lines", []))
        windows_parsed = parse_lines([line["text"] for line in windows_lines])
        chosen = windows_parsed
        engine = "windows"
        rapid_parsed = None
        rapid_raw = rapid_by_slide.get(slide)
        if rapid_raw:
            rapid_lines = rapid_raw.get("chosenLines", rapid_raw.get("passThresholded", []))
            rapid_parsed = parse_lines(
                [line["text"] if isinstance(line, dict) else str(line) for line in rapid_lines]
            )
            windows_labels = [option["letter"] for option in windows_parsed["options"]]
            windows_incomplete = (
                len(windows_parsed["questionText"]) < 8
                or windows_labels[:4] != list("ABCD")
                or any(not option["text"] for option in windows_parsed["options"])
            )
            if windows_incomplete and record_score(rapid_parsed) > record_score(windows_parsed):
                chosen = rapid_parsed
                engine = "rapidocr"
            # OCR engines often fail on different regions of the same slide.
            # Preserve the stronger option parse while filling an omitted stem
            # from the other engine (notably the very light text on slide 91).
            if len(chosen["questionText"]) < 8:
                alternate = rapid_parsed if chosen is windows_parsed else windows_parsed
                if len(alternate["questionText"]) >= 8:
                    chosen = {
                        "questionText": alternate["questionText"],
                        "options": chosen["options"],
                    }
                    engine = "windows+rapidocr"

        record = make_record(raw, chosen, engine)
        record["crossCheck"] = {
            "windowsScore": record_score(windows_parsed),
            "rapidOcrScore": record_score(rapid_parsed) if rapid_parsed else None,
            "enginesAgreeOnLabels": (
                [option["letter"] for option in windows_parsed["options"]]
                == [option["letter"] for option in rapid_parsed["options"]]
                if rapid_parsed
                else None
            ),
        }
        output.append(record)

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    questions = [record for record in output if record["isQuestion"]]
    difficult = [record for record in questions if record["confidence"] != "high"]
    print(f"records={len(output)} questions={len(questions)} dividers={len(output) - len(questions)}")
    print(f"high={len(questions) - len(difficult)} review={len(difficult)}")
    print("review_slides=" + ",".join(str(record["sourceSlide"]) for record in difficult))
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
