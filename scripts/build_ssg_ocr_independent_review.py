from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_ssg104_ocr import parse_lines, spatially_order_windows_lines  # noqa: E402


CURRENT_PATH = ROOT / "data" / "ssg" / "questions.json"
TESSERACT_PATH = ROOT / "data" / "ssg" / "ocr-tesseract-raw.json"
ENSEMBLE_PATH = ROOT / "data" / "ssg" / "audit" / "ocr-ensemble-review.json"
RAPID104_PATH = ROOT / "data" / "ssg" / "audit" / "ocr-independent-rapid-lines.json"
WINDOWS104_PATH = ROOT / "data" / "ssg104" / "ocr-windows-raw.json"
RAPID105_PATH = ROOT / "data" / "ssg105" / "ocr-raw" / "rapidocr.json"
WINDOWS105_PATH = ROOT / "data" / "ssg105" / "audit" / "ocr-asset-audit.json"
OVERRIDES_PATH = ROOT / "data" / "ssg" / "audit" / "ocr-independent-overrides.json"
OUTPUT_PATH = ROOT / "data" / "ssg" / "audit" / "ocr-independent-review.json"

SUSPICIOUS_OCR_TOKENS = {
    "itis",
    "cmembers",
    "adjouming",
    "protiem",
    "resdution",
    "aternpt",
    "connand",
    "ijsing",
    "vtiich",
    "leaming",
    "tiese",
    "inareoport",
    "titlefly",
    "introductionpart",
    "shanng",
    "proviciing",
    "rnindfulness",
    "corversation",
    "capadty",
    "pattem",
    "reasom",
    "whlch",
    "mitten",
    "trije",
    "companson",
    "disagreernents",
}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def similarity(left: str, right: str) -> float:
    if not left and not right:
        return 1.0
    return SequenceMatcher(None, normalize(left), normalize(right)).ratio()


def parsed_fields(parsed: dict[str, Any]) -> tuple[str, list[str]]:
    return parsed["questionText"], [option["text"] for option in parsed["options"]]


def parse_rapid104(record: dict[str, Any]) -> tuple[str, list[str]]:
    lines = [
        {"text": line["text"], "words": line["sourceBoxWords"]}
        for line in record["lines"]
    ]
    ordered = spatially_order_windows_lines(lines)
    return parsed_fields(parse_lines([line["text"] for line in ordered]))


def parse_windows104(record: dict[str, Any]) -> tuple[str, list[str]]:
    ordered = spatially_order_windows_lines(record["lines"])
    return parsed_fields(parse_lines([line["text"] for line in ordered]))


def parse_rapid105(record: dict[str, Any]) -> tuple[str, list[str]]:
    candidates: list[tuple[str, list[str]]] = []
    for pass_name in ("passOriginal", "passThresholded"):
        parsed = parse_lines([line["text"] for line in record.get(pass_name, [])])
        candidates.append(parsed_fields(parsed))
    return max(candidates, key=lambda item: (len(item[1]), len(item[0])))


def field_value(question: str, options: list[str], field: str) -> str:
    if field == "Q":
        return question
    index = ord(field) - ord("A")
    return options[index] if 0 <= index < len(options) else ""


def candidate_support(
    value: str,
    candidates: list[str],
    threshold: float = 0.985,
) -> int:
    return sum(bool(candidate) and similarity(value, candidate) >= threshold for candidate in candidates)


def main() -> None:
    current = json.loads(CURRENT_PATH.read_text(encoding="utf-8"))
    tesseract_raw = {
        record["id"]: record
        for record in json.loads(TESSERACT_PATH.read_text(encoding="utf-8"))
    }
    ensemble = {
        record["id"]: record
        for record in json.loads(ENSEMBLE_PATH.read_text(encoding="utf-8"))["records"]
    }
    rapid104 = {
        int(record["sourceSlide"]): record
        for record in json.loads(RAPID104_PATH.read_text(encoding="utf-8"))
    }
    windows104 = {
        int(record["sourceSlide"]): record
        for record in json.loads(WINDOWS104_PATH.read_text(encoding="utf-8-sig"))
    }
    rapid105 = {
        int(record["sourceSlide"]): record
        for record in json.loads(RAPID105_PATH.read_text(encoding="utf-8"))
    }
    windows105_records = json.loads(WINDOWS105_PATH.read_text(encoding="utf-8"))["records"]
    windows105 = {int(record["sourceSlide"]): record for record in windows105_records}
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    accept_tesseract = overrides["acceptTesseractFields"]
    manual_values = overrides["manualValues"]
    visual_slides = set(overrides["manualVisualSlides"])

    if len(current) != 483:
        raise RuntimeError(f"Expected 483 current questions, found {len(current)}")
    if len(tesseract_raw) != 483:
        raise RuntimeError(f"Expected 483 Tesseract records, found {len(tesseract_raw)}")
    if len(rapid104) != 353:
        raise RuntimeError(f"Expected 353 independent SSG104 RapidOCR records, found {len(rapid104)}")

    records: list[dict[str, Any]] = []
    question_corrections = 0
    option_corrections = 0
    changed_records = 0
    confidence_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()

    for item in current:
        question_id = item["id"]
        slide = int(item["sourceSlide"])
        subject = item["subject"]
        original_question = item["questionEn"]
        original_options = list(item["options"])
        ensemble_record = ensemble[question_id]
        tess_question = ensemble_record["tesseract"]["question"]
        tess_options = list(ensemble_record["tesseract"]["options"])

        if subject == "SSG104":
            rapid_question, rapid_options = parse_rapid104(rapid104[slide])
            windows_question, windows_options = parse_windows104(windows104[slide])
        else:
            rapid_question, rapid_options = parse_rapid105(rapid105[slide])
            windows_ocr = windows105[slide]["ocr"]
            windows_question = windows_ocr["questionText"]
            windows_options = [option["text"] for option in windows_ocr["options"]]

        corrected_question = original_question
        corrected_options = list(original_options)
        bases: dict[str, str] = {}

        for field in accept_tesseract.get(question_id, []):
            candidate = field_value(tess_question, tess_options, field)
            if not candidate:
                raise RuntimeError(f"{question_id} accepted empty Tesseract field {field}")
            if field == "Q":
                corrected_question = candidate
            else:
                index = ord(field) - ord("A")
                corrected_options[index] = candidate
            bases[field] = "Tesseract OCR correction confirmed against PNG/ensemble"

        for field, value in manual_values.get(question_id, {}).items():
            if field == "Q":
                corrected_question = value
            else:
                index = ord(field) - ord("A")
                if index >= len(corrected_options):
                    raise RuntimeError(f"{question_id} manual field {field} exceeds option count")
                corrected_options[index] = value
            bases[field] = "Manual visual transcription from source PNG"

        question_changed = corrected_question != original_question
        option_changed_indexes = [
            index
            for index, (before, after) in enumerate(zip(original_options, corrected_options))
            if before != after
        ]
        if question_changed or option_changed_indexes:
            changed_records += 1
        question_corrections += int(question_changed)
        option_corrections += len(option_changed_indexes)

        fields = [("Q", corrected_question)] + [
            (chr(ord("A") + index), option)
            for index, option in enumerate(corrected_options)
        ]
        field_confidences: list[str] = []
        field_support: dict[str, Any] = {}
        for field, value in fields:
            candidates = [
                field_value(tess_question, tess_options, field),
                field_value(rapid_question, rapid_options, field),
                field_value(windows_question, windows_options, field),
            ]
            support = candidate_support(value, candidates)
            is_manual_visual = slide in visual_slides
            if is_manual_visual or support >= 2:
                field_confidence = "high"
            elif support == 1:
                field_confidence = "medium"
            else:
                field_confidence = "low"
            field_confidences.append(field_confidence)
            field_support[field] = {
                "matchingIndependentEngines": support,
                "confidence": field_confidence,
            }

        overall_confidence = (
            "low"
            if "low" in field_confidences
            else "medium"
            if "medium" in field_confidences
            else "high"
        )
        confidence_counts[overall_confidence] += 1
        for basis in bases.values():
            source_counts[basis] += 1

        image_path = ROOT / "public" / subject.lower() / "source" / f"slide-{slide:04d}.png"
        image_sha256 = hashlib.sha256(image_path.read_bytes()).hexdigest()
        expected_sha = tesseract_raw[question_id]["sha256"]
        if image_sha256 != expected_sha:
            raise RuntimeError(f"{question_id} image hash changed during review")

        records.append(
            {
                "id": question_id,
                "subject": subject,
                "sourceSlide": slide,
                "image": item["image"],
                "originalCurrent": {
                    "question": original_question,
                    "options": original_options,
                },
                "correctedQuestion": corrected_question,
                "correctedOptions": corrected_options,
                "changed": {
                    "question": question_changed,
                    "optionIndexes": option_changed_indexes,
                    "optionLetters": [chr(ord("A") + index) for index in option_changed_indexes],
                },
                "confidence": overall_confidence,
                "evidence": {
                    "sourcePngSha256": image_sha256,
                    "manualVisualReview": slide in visual_slides,
                    "correctionBasisByField": bases,
                    "fieldSupport": field_support,
                    "tesseract": {
                        "question": tess_question,
                        "options": tess_options,
                        "confidence": ensemble_record["tesseract"]["confidence"],
                        "markerCount": ensemble_record["tesseract"]["markerCount"],
                    },
                    "rapidOcrIndependent": {
                        "question": rapid_question,
                        "options": rapid_options,
                    },
                    "windowsMediaOcr": {
                        "question": windows_question,
                        "options": windows_options,
                    },
                },
            }
        )

    slide18 = next(record for record in records if record["id"] == "SSG104-S018")
    if "Members implement plans" not in slide18["correctedQuestion"]:
        raise RuntimeError("Required slide 18 Members correction is missing")
    if slide18["correctedOptions"][2] != "Adjourning":
        raise RuntimeError("Required slide 18 Adjourning correction is missing")

    corpus_tokens: Counter[str] = Counter()
    changed_field_values: list[tuple[str, str, str]] = []
    for record in records:
        all_values = [record["correctedQuestion"], *record["correctedOptions"]]
        for value in all_values:
            corpus_tokens.update(re.findall(r"[A-Za-z][A-Za-z'-]*", value.lower()))
        if record["changed"]["question"]:
            changed_field_values.append((record["id"], "Q", record["correctedQuestion"]))
        for index in record["changed"]["optionIndexes"]:
            changed_field_values.append(
                (
                    record["id"],
                    chr(ord("A") + index),
                    record["correctedOptions"][index],
                )
            )

    regex_flags: list[dict[str, str]] = []
    changed_tokens: list[str] = []
    for question_id, field, value in changed_field_values:
        tokens = re.findall(r"[A-Za-z][A-Za-z'-]*", value.lower())
        changed_tokens.extend(tokens)
        bad_tokens = sorted(set(tokens) & SUSPICIOUS_OCR_TOKENS)
        if re.search(r"^(?:RR|EE|SS)(?:\s+(?:RR|EE|SS))", value):
            bad_tokens.append("border-artifact-prefix")
        for token in bad_tokens:
            regex_flags.append({"id": question_id, "field": field, "token": token})

    singleton_tokens = sorted(
        {
            token
            for token in changed_tokens
            if len(token) >= 4 and corpus_tokens[token] == 1
        }
    )
    suspicious_singletons = [
        token
        for token in singleton_tokens
        if (
            not re.search(r"[aeiouy]", token)
            or re.search(r"(?:vv|rn|ii|[a-z]\d|\d[a-z])", token)
        )
        and token not in {"fpt", "svo", "covid"}
    ]
    qa = {
        "correctedFieldCountChecked": len(changed_field_values),
        "regexFlagCount": len(regex_flags),
        "regexFlags": regex_flags,
        "wordFrequency": {
            "changedTokenCount": len(changed_tokens),
            "singletonLongTokenCount": len(singleton_tokens),
            "suspiciousSingletonCount": len(suspicious_singletons),
            "suspiciousSingletons": suspicious_singletons,
            "method": "Token frequencies were computed over all 483 corrected records; singleton tokens with no vowel or OCR-confusion patterns were reviewed.",
        },
    }
    if regex_flags:
        raise RuntimeError(f"Corrected-field OCR regex QA failed: {regex_flags}")

    output = {
        "schemaVersion": 1,
        "scope": {
            "questionCount": len(records),
            "subjects": {"SSG104": 353, "SSG105": 130},
            "sourceOfTruth": "PNG files under public/ssg104/source and public/ssg105/source",
            "currentDataUsedOnlyForDiff": "data/ssg/questions.json",
        },
        "method": {
            "engines": [
                "Tesseract OCR independently run over all 483 PNGs",
                "RapidOCR recognition-only over 353 SSG104 PNG line crops",
                "RapidOCR full-image passes over all 130 SSG105 PNGs",
                "Windows.Media.Ocr over PNGs as a third comparison",
            ],
            "rule": "Current question data is never treated as ground truth. Corrections require PNG transcription or independent OCR evidence; grammatical/source typos visible in the slide are preserved.",
        },
        "summary": {
            "totalRecords": len(records),
            "changedRecordCount": changed_records,
            "unchangedRecordCount": len(records) - changed_records,
            "questionCorrectionCount": question_corrections,
            "optionCorrectionCount": option_corrections,
            "totalCorrectedFields": question_corrections + option_corrections,
            "confidenceCounts": dict(confidence_counts),
            "correctionEvidenceCounts": dict(source_counts),
            "requiredSlide18": {
                "reviewed": True,
                "questionContainsMembers": True,
                "optionC": slide18["correctedOptions"][2],
            },
        },
        "qa": qa,
        "records": records,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
