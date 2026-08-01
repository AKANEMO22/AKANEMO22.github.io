import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const publicRoot = path.join(projectRoot, "public");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const [source, questions, exams, stats, manifest, extractionAudit, ocrAudit, rapidOcr, answerReview] = await Promise.all([
  json("data/ssg105/source-notes.json"),
  json("data/ssg105/questions.json"),
  json("data/ssg105/exams.json"),
  json("data/ssg105/stats.json"),
  json("public/ssg105/source/manifest.json"),
  json("data/ssg105/audit/extraction-audit.json"),
  json("data/ssg105/audit/ocr-asset-audit.json"),
  json("data/ssg105/ocr-raw/rapidocr.json"),
  json("data/ssg105/audit/answer-review.json"),
]);

assert.equal(source.totalSlides, 507);
assert.equal(source.markerSlide, 377);
assert.equal(source.firstQuestionSlide, 378);
assert.equal(source.lastQuestionSlide, 507);
assert.equal(source.questionCount, 130);
assert.equal(source.questions.length, 130);
assert.equal(extractionAudit.integrity.sourceSha256Matches, true);
assert.equal(extractionAudit.summary.extractedSlideCount, 130);
assert.equal(ocrAudit.finalInventory.presentCount, 130);
assert.equal(ocrAudit.finalInventory.sequenceComplete, true);
assert.equal(rapidOcr.length, 130);
assert.equal(answerReview.summary.reviewedCount, 130);
assert.equal(answerReview.summary.answerLetterConflicts, 0);
assert.equal(answerReview.summary.assetConflicts, 0);
assert.deepEqual(answerReview.summary.blockingBeforeCanonicalPublish, []);

assert.equal(questions.length, 130);
assert.deepEqual(
  questions.map((question) => question.sourceSlide),
  Array.from({ length: 130 }, (_, index) => index + 378),
);
assert.equal(new Set(questions.map((question) => question.id)).size, 130);
assert.equal(new Set(questions.map((question) => question.pageId)).size, 130);

for (const question of questions) {
  assert.ok(question.questionVi.trim().length >= 8, `${question.id}: missing questionVi`);
  assert.ok(question.correctAnswer.trim().length >= 4, `${question.id}: missing correctAnswer`);
  assert.ok(question.explanationVi.trim().length >= 20, `${question.id}: missing explanationVi`);
  assert.match(question.answerLetter, /^[A-E]$/);
  assert.ok(Number.isInteger(question.answerIndex));
  assert.ok(question.optionCount === 4 || question.optionCount === 5);
  assert.ok(question.answerIndex >= 0 && question.answerIndex < question.optionCount);
  assert.equal(question.verification.status, "verified");
  assert.ok(question.verification.confidence >= 0.8);
  assert.ok(question.verification.evidence.length >= 3);
  assert.equal(
    answerReview.proposedAnswerBySourceSlide[String(question.sourceSlide)],
    question.answerLetter,
  );
  assert.deepEqual(question.qualityFlags, []);
}

assert.equal(manifest.sourceSha256, source.sourceSha256);
assert.equal(manifest.assetCount, 130);
assert.equal(manifest.assets.length, 130);
assert.equal(new Set(manifest.assets.map((asset) => asset.sha256)).size, 130);
assert.deepEqual(
  manifest.assets.map((asset) => asset.sourceSlide),
  Array.from({ length: 130 }, (_, index) => index + 378),
);

for (const asset of manifest.assets) {
  const imagePath = path.join(publicRoot, asset.path.replace(/^\//, ""));
  await access(imagePath);
  const buffer = await readFile(imagePath);
  const dimensions = pngDimensions(buffer);
  assert.deepEqual(dimensions, { width: 960, height: 540 });
  assert.equal(asset.width, 960);
  assert.equal(asset.height, 540);
  assert.equal(asset.bytes, buffer.byteLength);
  assert.equal(asset.sha256, createHash("sha256").update(buffer).digest("hex"));

  const rapidRecord = rapidOcr.find((record) => record.sourceSlide === asset.sourceSlide);
  assert.ok(rapidRecord, `slide ${asset.sourceSlide}: missing RapidOCR record`);
  assert.equal(rapidRecord.sha256, asset.sha256);
  assert.equal(rapidRecord.width, 960);
  assert.equal(rapidRecord.height, 540);
  assert.ok(rapidRecord.optionLetters.length >= 2);
  assert.ok(rapidRecord.passOriginal.length > 0);
}
assert.ok(rapidOcr.filter((record) => record.optionLetters.length >= 4).length >= 120);

assert.equal(exams.length, 3);
for (const exam of exams) {
  assert.equal(exam.questionIds.length, 50, `${exam.id}: must contain 50 questions`);
  assert.equal(new Set(exam.questionIds).size, 50, `${exam.id}: duplicate within exam`);
  assert.ok(exam.questionIds.every((id) => questions.some((question) => question.id === id)));
}

const assignments = exams.flatMap((exam) => exam.questionIds);
const assignmentCount = assignments.reduce((result, id) => {
  result[id] = (result[id] ?? 0) + 1;
  return result;
}, {});
assert.equal(assignments.length, 150);
assert.equal(new Set(assignments).size, 130);
assert.equal(Object.values(assignmentCount).filter((count) => count === 2).length, 20);
assert.ok(Object.values(assignmentCount).every((count) => count === 1 || count === 2));

assert.equal(stats.uniqueQuestionCount, 130);
assert.equal(stats.practiceAssignmentCount, 150);
assert.equal(stats.repeatedForPractice.length, 20);
assert.equal(stats.topics.reduce((sum, topic) => sum + topic.count, 0), 130);
assert.ok(stats.topics.every((topic) => topic.advice?.trim().length >= 20));
assert.ok(
  stats.repeatedForPractice.every(
    (item) => item.sourceOccurrenceCount === 1 && item.practiceAssignmentCount === 2,
  ),
);

console.log("SSG105 validation passed: 130 verified questions, 130 clean images, 2 OCR engines, 3×50 assignments.");
