import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
async function json(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

const [questions, base, liveNotes, ensemble, agentReview, report] = await Promise.all([
  json("data/ssg/questions.json"),
  json("data/ssg/translations-vi.json"),
  json("data/ssg/live-speaker-notes.json"),
  json("data/ssg/audit/ocr-ensemble-review.json"),
  json("data/ssg/audit/.translation-glossary-agent.json"),
  json("data/ssg/audit/translations-vi-reviewed.json"),
]);

assert.equal(report.schemaVersion, 1);
assert.equal(report.language, "vi");
assert.equal(report.translations.length, 483);
assert.equal(report.summary.questionCount, 483);
assert.equal(report.summary.reviewedCount, 483);
assert.equal(report.summary.optionCount, questions.reduce((sum, question) => sum + question.options.length, 0));
assert.equal(report.summary.liveSpeakerNotesPresentCount, 483);
assert.equal(report.summary.independentAgentCorrectionRecordCount, agentReview.corrections.length);
assert.equal(liveNotes.slideCount, 507);
assert.equal(ensemble.totalQuestions, 483);
assert.equal(new Set(report.translations.map((record) => record.id)).size, 483);
assert.ok(agentReview.corrections.length >= 70);
assert.deepEqual(
  report.translations.map((record) => record.id),
  questions.map((question) => question.id),
);

const baseById = new Map(base.translations.map((record) => [record.id, record]));
for (const [index, record] of report.translations.entries()) {
  const question = questions[index];
  assert.equal(record.id, question.id);
  assert.equal(record.sourceSlide, question.sourceSlide);
  assert.equal(record.question, question.question);
  assert.deepEqual(record.options, question.options);
  assert.ok(record.questionVi.trim(), `${record.id}: missing questionVi`);
  assert.equal(record.optionsVi.length, question.options.length);
  assert.ok(record.optionsVi.every((option) => option.trim()), `${record.id}: blank optionsVi`);
  assert.equal(record.optionReviews.length, question.options.length);
  assert.ok(record.translationReview.liveSpeakerNotesPresent, `${record.id}: missing live notes evidence`);
  assert.ok(["reviewed", "reviewed-with-english-source-warning"].includes(record.translationReview.status));
  assert.ok(baseById.has(record.id));
}

for (const ocrRecord of ensemble.records.filter((record) => record.needsReview)) {
  const translation = report.translations.find((record) => record.id === ocrRecord.id);
  assert.ok(
    translation.translationReview.flags.includes("english-ocr-ensemble-needs-review"),
    `${ocrRecord.id}: OCR uncertainty is not marked`,
  );
}
for (const correction of agentReview.corrections) {
  const translation = report.translations.find((record) => record.id === correction.id);
  assert.ok(translation, `agent correction points to unknown id ${correction.id}`);
  assert.ok(
    translation.translationReview.flags.includes("independent-agent-correction-applied"),
    `${correction.id}: independent translation review is not recorded`,
  );
}

const slide18 = report.translations.find((record) => record.id === "SSG104-S018");
assert.ok(slide18, "slide 18 translation missing");
assert.equal(
  slide18.questionVi,
  "Giai đoạn nào phù hợp với phát biểu “Các thành viên thực hiện kế hoạch và đạt được mục tiêu”?",
);
assert.deepEqual(slide18.optionsVi, [
  "Thực hiện hiệu quả",
  "Xung đột",
  "Kết thúc",
  "Ổn định – chuẩn hóa",
  "Hình thành",
]);
assert.ok(slide18.translationReview.liveSpeakerNotesPresent);

const forbiddenMachinePhrases = [
  /\bBão tố\b/,
  /^Biểu diễn[.!]?$/,
  /Đang bổ sung/,
  /^Định chuẩn[.!]?$/,
  /^Đang đăng ký[.!]?$/,
  /Ngôn ngữ song ngữ/,
  /^Mất điện[.!]?$/,
  /^Cấp nguồn[.!]?$/,
  /^Phút[.!]?$/,
  /Đặc tính, mầm bệnh và Logo/,
  /So sánh độ tương phản/,
];
for (const record of report.translations) {
  for (const option of record.optionsVi) {
    assert.ok(
      forbiddenMachinePhrases.every((pattern) => !pattern.test(option)),
      `${record.id}: unreviewed machine phrase remains: ${option}`,
    );
  }
}

assert.equal(report.summary.englishSourceWarningCount, ensemble.reviewCount);
console.log(
  `Vietnamese translation validation passed: 483 questions, ${report.summary.optionCount} options, slide 18 and glossary checks passed.`,
);
