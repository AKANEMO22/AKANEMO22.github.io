import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(
  projectRoot,
  "data",
  "ssg",
  "audit",
  "answer-multiselect-review-v2.json",
);

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function selectionInstruction(question) {
  const text = `${question.question} ${question.questionVi}`;
  const numeric = text.match(
    /(?:choose|select|check|mark|chọn|đánh dấu)\s*\(?\s*(\d+)\s*(?:answers?|options?|đáp án|lựa chọn)?/i,
  );
  if (numeric) return { indicatesMultiple: Number(numeric[1]) > 1, expectedCount: Number(numeric[1]) };
  const words = text.match(
    /(?:choose|select|check|mark|chọn|đánh dấu)\s*\(?\s*(two|three|four)\b/i,
  )?.[1]?.toLowerCase();
  if (words) {
    const expectedCount = { two: 2, three: 3, four: 4 }[words];
    return { indicatesMultiple: true, expectedCount };
  }
  if (/more than one answer|multiple answers?|nhiều hơn một đáp án/i.test(text)) {
    return { indicatesMultiple: true, expectedCount: null };
  }
  return { indicatesMultiple: false, expectedCount: 1 };
}

const [questions, review104, review105, multiselectAgentReview] = await Promise.all([
  json("data/ssg/questions.json"),
  json("data/ssg104/audit/answer-review.json"),
  json("data/ssg105/audit/answer-review.json"),
  json("data/ssg/audit/.multiselect-agent-review.json"),
]);

const conflict104BySlide = new Map(review104.conflicts.map((record) => [record.sourceSlide, record]));
const uncertain104BySlide = new Map(review104.uncertain.map((record) => [record.sourceSlide, record]));
const semanticFocus104 = new Set(review104.coverage.semanticFocusSlides);
const answerCodeOnly104 = new Set(review104.coverage.answerCodeOnlySlides);
const proposed105BySlide = new Map(
  Object.entries(review105.proposedAnswerBySourceSlide).map(([slide, letter]) => [Number(slide), [letter]]),
);
const priority105BySlide = new Map(review105.priorityReviews.map((record) => [record.sourceSlide, record]));
const special105BySlide = new Map(review105.specialReviews.map((record) => [record.sourceSlide, record]));
const caveat105Slides = new Set(review105.summary.lowerConfidenceOrAmbiguousSlides);
const multiselectAgentBySlide = new Map(
  multiselectAgentReview.reviews
    .filter((record) => record.expectedCount !== 1)
    .map((record) => [
      record.slide,
      {
        sourceSlide: record.slide,
        currentAnswerLetters: record.currentAnswers,
        proposedAnswerLetters: record.proposedAnswers,
        expectedCount: record.expectedCount,
        verdict: record.verdict,
        reason: record.reason,
        confidence: record.confidence,
      },
    ]),
);

const records = questions.map((question) => {
  const instruction = selectionInstruction(question);
  const conflict = conflict104BySlide.get(question.sourceSlide);
  const uncertain = uncertain104BySlide.get(question.sourceSlide);
  const priority105 = question.subject === "SSG105" ? priority105BySlide.get(question.sourceSlide) : null;
  const special105 = question.subject === "SSG105" ? special105BySlide.get(question.sourceSlide) : null;
  const multiselectCrossReview = multiselectAgentBySlide.get(question.sourceSlide);

  let verdict;
  let proposedAnswerLetters;
  let reason;
  let confidence;

  if (conflict) {
    verdict = "semantic-conflict";
    proposedAnswerLetters = conflict.proposedAnswerLetters;
    reason = conflict.reason;
    confidence = 0.96;
  } else if (uncertain) {
    verdict = "semantic-uncertain";
    proposedAnswerLetters = multiselectCrossReview?.proposedAnswerLetters ?? question.answerLetters;
    reason = multiselectCrossReview
      ? `${uncertain.reason} Second independent multi-select review: ${multiselectCrossReview.reason}`
      : uncertain.reason;
    confidence = 0.55;
  } else if (question.subject === "SSG105" && caveat105Slides.has(question.sourceSlide)) {
    verdict = "agreed-with-caveat";
    proposedAnswerLetters = proposed105BySlide.get(question.sourceSlide) ?? question.answerLetters;
    reason =
      priority105?.reviewNote ??
      priority105?.explanationVi ??
      special105?.explanationVi ??
      "Đáp án trùng speaker notes nhưng cách diễn đạt hoặc phạm vi khái niệm còn mơ hồ; giữ đáp án với confidence thấp hơn.";
    confidence =
      review105.confidencePolicy.overrides[String(question.sourceSlide)] ??
      review105.confidencePolicy.default;
  } else if (question.subject === "SSG105") {
    verdict = "agreed";
    proposedAnswerLetters = proposed105BySlide.get(question.sourceSlide) ?? question.answerLetters;
    reason =
      priority105?.explanationVi ??
      special105?.explanationVi ??
      "Kiểm tra độc lập ảnh sạch, OCR, các lựa chọn và speaker notes không phát hiện mâu thuẫn với đáp án hiện tại.";
    confidence =
      review105.confidencePolicy.overrides[String(question.sourceSlide)] ??
      review105.confidencePolicy.default;
  } else {
    verdict = "agreed";
    proposedAnswerLetters = question.answerLetters;
    reason = semanticFocus104.has(question.sourceSlide)
      ? "Đã đọc nội dung câu hỏi và toàn bộ lựa chọn OCR; đáp án hiện tại tồn tại trong ảnh và không phát hiện mâu thuẫn ngữ nghĩa độc lập."
      : "Mã đáp án hợp lệ trong tập lựa chọn OCR; nội dung đáp án/lời giải từ speaker notes hỗ trợ cùng kết luận và không phát hiện dấu hiệu đảo khóa.";
    confidence = semanticFocus104.has(question.sourceSlide) ? 0.92 : 0.9;
  }

  const countMismatch =
    instruction.expectedCount !== null &&
    instruction.expectedCount > 1 &&
    proposedAnswerLetters.length !== instruction.expectedCount;
  const modeMismatch = instruction.indicatesMultiple && question.responseMode !== "multiple";

  return {
    id: question.id,
    subject: question.subject,
    sourceSlide: question.sourceSlide,
    image: question.image,
    question: question.question,
    options: question.options.map((text, index) => ({
      letter: String.fromCharCode(65 + index),
      text,
    })),
    currentAnswerLetters: question.answerLetters,
    currentSelectedOptions: question.answerLetters.map((letter) => ({
      letter,
      text: question.options[letter.charCodeAt(0) - 65] ?? "",
    })),
    proposedAnswerLetters,
    proposedSelectedOptions: proposedAnswerLetters.map((letter) => ({
      letter,
      text: question.options[letter.charCodeAt(0) - 65] ?? "",
    })),
    currentAnswerSource: "speaker-notes",
    responseMode: question.responseMode,
    recommendedResponseMode:
      modeMismatch && proposedAnswerLetters.length > 1
        ? "multiple"
        : modeMismatch
          ? "manual-review"
          : proposedAnswerLetters.length > 1
            ? "multiple"
            : "single",
    promptSelectionCount: instruction.expectedCount,
    promptIndicatesMultiple: instruction.indicatesMultiple,
    verdict,
    reason,
    confidence,
    evidence: unique([
      "speaker-notes",
      "clean-source-image",
      "image-ocr-options",
      question.subject === "SSG104"
        ? "data/ssg104/audit/answer-review.json"
        : "data/ssg105/audit/answer-review.json",
      answerCodeOnly104.has(question.sourceSlide) && question.subject === "SSG104"
        ? "answer-code-only-semantic-focus"
        : null,
      multiselectCrossReview ? "second-independent-multiselect-review" : null,
    ]),
    flags: unique([
      verdict === "semantic-conflict" ? "answer-key-conflict" : null,
      verdict === "semantic-uncertain" ? "answer-key-uncertain" : null,
      verdict === "agreed-with-caveat" ? "wording-or-scope-caveat" : null,
      modeMismatch ? "prompt-response-mode-mismatch" : null,
      countMismatch ? "prompt-selection-count-mismatch" : null,
    ]),
    multiselectCrossReview: multiselectCrossReview ?? null,
  };
});

const multiSelectReview = records.filter(
  (record) => record.responseMode === "multiple" || record.promptIndicatesMultiple,
);
const verdictCounts = records.reduce((result, record) => {
  result[record.verdict] = (result[record.verdict] ?? 0) + 1;
  return result;
}, {});

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  title: "Independent answer and multi-select review for the complete SSG question bank",
  scope: {
    uniqueQuestionCount: questions.length,
    ssg104QuestionCount: questions.filter((question) => question.subject === "SSG104").length,
    ssg105QuestionCount: questions.filter((question) => question.subject === "SSG105").length,
    responseModeMultipleCount: questions.filter((question) => question.responseMode === "multiple").length,
    promptIndicatesMultipleCount: multiSelectReview.filter((record) => record.promptIndicatesMultiple).length,
    answerCodeOnlyPriorityCount: review104.coverage.answerCodeOnlyCount,
    fullCoverage: records.length === questions.length,
  },
  method: {
    sourcePriority:
      "Speaker-note keys are the current answers, but visible question/option semantics and explicit selection-count wording are treated as independent evidence. Conflicts are reported rather than silently accepting or mutating the key.",
    ssg104:
      "Reused the 353-question independent SSG104 semantic/structural review, which explicitly read all answer-code-only, multi-answer and flagged questions and structurally checked the remainder against OCR options and notes.",
    ssg105:
      "Reused the 130-question independent SSG105 image/OCR/notes review with per-slide proposed answers and confidence overrides; its three ambiguity cases remain explicit caveats.",
    multiselect:
      "A second independent agent re-solved all 18 true multi-select or prompt-multi records. Its complete evidence is data/ssg/audit/.multiselect-agent-review.json and is embedded per record as multiselectCrossReview.",
    limitations: [
      "Không có answer manual chính thức ngoài speaker notes trong slide.",
      "Một số câu phụ thuộc thuật ngữ hoặc ma trận nội dung riêng của học phần; các câu đó được đánh dấu uncertain thay vì tự ý đổi khóa.",
      "Đây là audit riêng; questions.json và builder không bị sửa bởi bước kiểm định này.",
    ],
  },
  summary: {
    reviewedQuestionCount: records.length,
    verdictCounts,
    proposedAnswerChangeCount: records.filter(
      (record) => record.currentAnswerLetters.join("") !== record.proposedAnswerLetters.join(""),
    ).length,
    semanticConflictIds: records
      .filter((record) => record.verdict === "semantic-conflict")
      .map((record) => record.id),
    semanticUncertainIds: records
      .filter((record) => record.verdict === "semantic-uncertain")
      .map((record) => record.id),
    agreedWithCaveatIds: records
      .filter((record) => record.verdict === "agreed-with-caveat")
      .map((record) => record.id),
    promptResponseModeMismatchIds: records
      .filter((record) => record.flags.includes("prompt-response-mode-mismatch"))
      .map((record) => record.id),
    promptSelectionCountMismatchIds: records
      .filter((record) => record.flags.includes("prompt-selection-count-mismatch"))
      .map((record) => record.id),
  },
  multiAnswerQuestionIds: records
    .filter((record) => record.responseMode === "multiple")
    .map((record) => record.id),
  multiSelectReview,
  records,
};

if (questions.length !== 483 || records.length !== 483) {
  throw new Error(`Expected full 483-question review, received ${records.length}.`);
}
if (review104.summary.reviewedCount + review105.summary.reviewedCount !== 483) {
  throw new Error("Underlying independent reviews do not cover all 483 questions.");
}
assert.equal(report.scope.ssg104QuestionCount, 353);
assert.equal(report.scope.ssg105QuestionCount, 130);
assert.equal(report.scope.responseModeMultipleCount, 16);
assert.equal(report.scope.promptIndicatesMultipleCount, 18);
assert.deepEqual(report.summary.verdictCounts, {
  agreed: 469,
  "semantic-uncertain": 7,
  "semantic-conflict": 4,
  "agreed-with-caveat": 3,
});
assert.equal(report.summary.proposedAnswerChangeCount, 8);
assert.deepEqual(report.summary.promptResponseModeMismatchIds, ["SSG104-S284", "SSG104-S357"]);
assert.deepEqual(report.summary.promptSelectionCountMismatchIds, [
  "SSG104-S075",
  "SSG104-S076",
  "SSG104-S082",
  "SSG104-S337",
]);
assert.equal(report.multiAnswerQuestionIds.length, 16);
assert.equal(report.multiSelectReview.length, 18);
assert.ok(report.multiSelectReview.every((record) => record.multiselectCrossReview));
for (const record of records) {
  const question = questions.find((item) => item.id === record.id);
  assert.deepEqual(record.currentAnswerLetters, question.answerLetters);
  assert.ok(record.reason.trim());
  assert.ok(record.confidence > 0 && record.confidence <= 1);
}
for (const slide of review104.coverage.answerCodeOnlySlides) {
  const record = records.find((item) => item.subject === "SSG104" && item.sourceSlide === slide);
  assert.ok(record.evidence.includes("answer-code-only-semantic-focus"));
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${records.length} answer reviews (${multiSelectReview.length} multi-select/prompt-multi records) to ${outputPath}.`,
);
