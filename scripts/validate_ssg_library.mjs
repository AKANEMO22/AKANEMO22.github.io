import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const excludedSsg104Slides = [
  20, 55, 63, 72, 83, 86, 90, 122, 148, 156, 216, 249, 288, 319, 332,
];

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

const [source104, source105, audit104, answerReview104, ocr104, ocr104Corrections, ocr105Corrections, ocr105English, viTranslations, questions, exams, stats, sourceSummary, manifest] =
  await Promise.all([
    json("data/ssg104/source-notes.json"),
    json("data/ssg105/source-notes.json"),
    json("data/ssg104/audit/extraction-audit.json"),
    json("data/ssg104/audit/answer-review.json"),
    json("data/ssg104/ocr-combined.json"),
    json("data/ssg104/ocr-corrections.json"),
    json("data/ssg105/ocr-corrections.json"),
    json("data/ssg105/ocr-raw/english.json"),
    json("data/ssg/translations-vi.json"),
    json("data/ssg/questions.json"),
    json("data/ssg/exams.json"),
    json("data/ssg/stats.json"),
    json("data/ssg/source-summary.json"),
    json("data/ssg/asset-manifest.json"),
  ]);

assert.equal(source104.questionCount, 368);
assert.equal(source105.questionCount, 130);
assert.equal(audit104.integrity.sourceSha256Matches, true);
assert.deepEqual(audit104.integrity.missingSlides, []);
assert.equal(audit104.summary.extractedSlideCount, 368);
assert.equal(answerReview104.summary.reviewedCount, 353);
assert.equal(answerReview104.summary.agreedCount, 342);
assert.equal(answerReview104.summary.conflictCount, 4);
assert.equal(answerReview104.summary.uncertainCount, 7);
assert.equal(answerReview104.summary.countsBalance, 353);
assert.equal(ocr104.length, 368);
assert.equal(ocr105English.length, 130);
assert.equal(new Set(ocr105English.map((record) => record.sourceSlide)).size, 130);
assert.equal(viTranslations.questionCount, 483);
assert.equal(viTranslations.optionCount, 2013);
assert.equal(viTranslations.translations.length, 483);

const excludedRecords = source104.questions.filter((question) =>
  excludedSsg104Slides.includes(question.sourceSlide),
);
assert.equal(excludedRecords.length, 15);
for (const record of excludedRecords) {
  assert.deepEqual(record.answerLetters, [], `slide ${record.sourceSlide}: separator has an answer`);
  assert.equal(record.questionVi, "", `slide ${record.sourceSlide}: separator has question text`);
  assert.equal(record.correctAnswer, "", `slide ${record.sourceSlide}: separator has answer text`);
  assert.equal(record.explanationVi, "", `slide ${record.sourceSlide}: separator has explanation`);
  assert.deepEqual(record.notes, [], `slide ${record.sourceSlide}: separator has speaker notes`);
  assert.equal(
    ocr104.find((ocrRecord) => ocrRecord.sourceSlide === record.sourceSlide)?.isQuestion,
    false,
    `slide ${record.sourceSlide}: OCR classification must mark the separator as non-question`,
  );
}
assert.equal(ocr104.filter((record) => record.isQuestion).length, 353);
assert.deepEqual(
  ocr104.filter((record) => !record.isQuestion).map((record) => record.sourceSlide),
  excludedSsg104Slides,
);

const expectedSourceQuestions = [
  ...source104.questions.filter((question) => !excludedSsg104Slides.includes(question.sourceSlide)),
  ...source105.questions,
];
assert.equal(expectedSourceQuestions.length, 483);
assert.equal(questions.length, 483);
assert.deepEqual(
  questions.map((question) => question.id),
  expectedSourceQuestions.map((question) => question.id),
);
assert.equal(new Set(questions.map((question) => question.id)).size, 483);
assert.equal(new Set(questions.map((question) => question.pageId)).size, 483);
assert.equal(new Set(questions.map((question) => question.sourceSlide)).size, 483);
assert.equal(questions.filter((question) => question.subject === "SSG104").length, 353);
assert.equal(questions.filter((question) => question.subject === "SSG105").length, 130);
assert.ok(questions.every((question) => !excludedSsg104Slides.includes(question.sourceSlide)));

for (const [index, question] of questions.entries()) {
  assert.equal(question.schemaVersion, 2);
  assert.equal(question.libraryOrdinal, index + 1);
  assert.match(question.id, /^SSG10[45]-S\d{3}$/);
  assert.ok(["SSG104", "SSG105"].includes(question.subject));
  assert.ok(question.pageId);
  assert.ok(question.question.trim(), `${question.id}: missing question text`);
  assert.ok(question.image.startsWith(`/${question.subject.toLowerCase()}/source/`));
  assert.equal(question.source.pageId, question.pageId);
  assert.equal(question.source.slide, question.sourceSlide);
  assert.equal(question.source.image, question.image);
  assert.ok(Array.isArray(question.options));
  assert.ok(Array.isArray(question.optionsVi));
  assert.equal(
    question.optionsVi.length,
    question.options.length,
    `${question.id}: translated option count mismatch`,
  );
  assert.ok(question.optionsVi.every((option) => option.trim()), `${question.id}: blank translated option`);
  assert.ok(question.questionVi.trim(), `${question.id}: missing Vietnamese question`);
  assert.ok(Array.isArray(question.answerLetters));
  assert.ok(Array.isArray(question.answerIndexes));
  assert.ok(question.answerLetters.length >= 1, `${question.id}: missing answer letter`);
  assert.deepEqual(
    question.answerIndexes,
    question.answerLetters.map((letter) => letter.charCodeAt(0) - 65),
  );
  assert.equal(question.responseMode, question.answerLetters.length > 1 ? "multiple" : "single");
  if (question.options.length) {
    assert.ok(question.options.length >= 4, `${question.id}: incomplete OCR option set`);
    assert.ok(question.options.every((option) => option.trim()), `${question.id}: blank OCR option`);
    assert.ok(
      Math.max(...question.answerIndexes) < question.options.length,
      `${question.id}: answer is outside OCR option set`,
    );
  }
  assert.ok(question.explanation === question.explanationVi);
  assert.ok(question.correctAnswer.trim(), `${question.id}: missing resolved answer text`);
  assert.ok(question.explanation.trim(), `${question.id}: missing solution text`);
  assert.equal(question.sourceOccurrenceCount, 1);
  assert.ok(question.verification.status);
  assert.ok(Array.isArray(question.verification.evidence));
  assert.ok(Array.isArray(question.verification.issues));
}

for (const translation of viTranslations.translations) {
  const question = questions.find((item) => item.id === translation.id);
  assert.ok(question, `missing translated question ${translation.id}`);
  assert.equal(translation.question, question.question, `${translation.id}: translation source question drifted`);
  assert.deepEqual(translation.options, question.options, `${translation.id}: translation source options drifted`);
  assert.equal(translation.questionVi, question.questionVi, `${translation.id}: question translation not applied`);
  assert.deepEqual(translation.optionsVi, question.optionsVi, `${translation.id}: option translations not applied`);
}

assert.equal(questions.filter((question) => question.responseMode === "multiple").length, 16);
const expectedMultiAnswerCodes = new Map([
  [73, "AC"], [74, "BD"], [75, "AD"], [76, "AB"],
  [77, "CE"], [78, "AC"], [79, "BC"], [80, "AD"],
  [81, "AB"], [82, "AB"], [84, "ABC"], [85, "ABD"],
  [333, "AB"], [337, "ABCD"], [340, "BCDE"], [373, "CD"],
]);
for (const [sourceSlide, answerCode] of expectedMultiAnswerCodes) {
  const question = questions.find((item) => item.sourceSlide === sourceSlide);
  assert.ok(question, `missing multi-answer slide ${sourceSlide}`);
  assert.equal(question.responseMode, "multiple", `slide ${sourceSlide}: response mode drifted`);
  assert.equal(question.answerLetters.join(""), answerCode, `slide ${sourceSlide}: answer code drifted`);
  assert.equal(question.answerIndexes.length, answerCode.length, `slide ${sourceSlide}: answer count drifted`);
  assert.ok(
    question.answerIndexes.every((index) => question.options[index]?.trim()),
    `slide ${sourceSlide}: keyed option is missing after OCR`,
  );
  assert.equal(
    (question.correctAnswer.match(/(?:^|; )[A-F]\. /g) ?? []).length,
    answerCode.length,
    `slide ${sourceSlide}: resolved answer does not expose every keyed option`,
  );
}
for (const review of answerReview104.conflicts) {
  const question = questions.find((item) => item.id === review.id);
  assert.ok(question, `missing semantic-conflict question ${review.id}`);
  assert.deepEqual(
    question.answerLetters,
    review.keyedAnswerLetters,
    `${review.id}: speaker-note answer must not be replaced by semantic proposal`,
  );
  assert.equal(question.verification.status, "semantic-conflict");
  assert.equal(question.verification.answerVerified, false);
  assert.ok(question.verification.evidence.includes("independent-semantic-answer-review"));
  assert.ok(question.verification.issues.includes("semantic-answer-conflict"));
  assert.ok(question.qualityFlags.includes("semantic-answer-conflict"));
  assert.deepEqual(question.verification.semanticReview.proposedAnswerLetters, review.proposedAnswerLetters);
}
for (const review of answerReview104.uncertain) {
  const question = questions.find((item) => item.id === review.id);
  assert.ok(question, `missing semantic-uncertain question ${review.id}`);
  assert.deepEqual(question.answerLetters, review.keyedAnswerLetters);
  assert.equal(question.verification.status, "semantic-uncertain");
  assert.equal(question.verification.answerVerified, false);
  assert.ok(question.verification.evidence.includes("independent-semantic-answer-review"));
  assert.ok(question.verification.issues.includes("semantic-answer-uncertain"));
  assert.ok(question.qualityFlags.includes("semantic-answer-uncertain"));
  assert.deepEqual(question.verification.semanticReview.plausibleAnswerLetters, review.plausibleAnswerLetters);
}
for (const correction of [...ocr104Corrections.corrections, ...ocr105Corrections.corrections]) {
  const question = questions.find((item) => item.sourceSlide === correction.sourceSlide);
  assert.ok(question, `missing corrected OCR slide ${correction.sourceSlide}`);
  assert.equal(
    question.question,
    correction.questionText,
    `slide ${correction.sourceSlide}: corrected question was not applied exactly`,
  );
  assert.deepEqual(
    question.options,
    correction.options.map((option) => option.text),
    `slide ${correction.sourceSlide}: OCR correction was not applied exactly`,
  );
}

const ssg105Text = questions
  .filter((question) => question.subject === "SSG105")
  .flatMap((question) => [question.question, ...question.options])
  .join("\n");
assert.doesNotMatch(
  ssg105Text,
  /(?:VVh|V%|ttE|TTE|dialogue_|cornpetition|Inclu&|Whatis|Whatdoes|Whatarethe)/,
  "SSG105 still contains a known legacy OCR corruption marker",
);

assert.equal(exams.length, 10);
for (const [index, exam] of exams.entries()) {
  assert.equal(exam.id, `SSG-LIB-${String(index + 1).padStart(2, "0")}`);
  assert.equal(exam.questionIds.length, 50, `${exam.id}: expected 50 assignments`);
  assert.equal(exam.assignments.length, 50, `${exam.id}: assignments metadata mismatch`);
  assert.equal(new Set(exam.questionIds).size, 50, `${exam.id}: duplicate inside one exam`);
  assert.deepEqual(
    exam.questionIds,
    exam.assignments.map((assignment) => assignment.questionId),
  );
  assert.ok(exam.questionIds.every((id) => questions.some((question) => question.id === id)));
  assert.equal(exam.sourceQuestionCount, index === 9 ? 33 : 50);
  assert.equal(exam.repeatedQuestionCount, index === 9 ? 17 : 0);
}

assert.ok(exams.slice(0, 9).flatMap((exam) => exam.assignments).every((item) => item.kind === "source"));
assert.ok(exams[9].assignments.slice(0, 33).every((item) => item.kind === "source"));
assert.ok(exams[9].assignments.slice(33).every((item) => item.kind === "practice-repeat"));
assert.deepEqual(exams[9].questionIds.slice(0, 33), questions.slice(450).map((question) => question.id));

const assignments = exams.flatMap((exam) => exam.questionIds);
const assignmentCounts = assignments.reduce((result, id) => {
  result[id] = (result[id] ?? 0) + 1;
  return result;
}, {});
assert.equal(assignments.length, 500);
assert.equal(new Set(assignments).size, 483);
assert.equal(Object.values(assignmentCounts).filter((count) => count === 2).length, 17);
assert.equal(Object.values(assignmentCounts).filter((count) => count === 1).length, 466);
assert.ok(Object.values(assignmentCounts).every((count) => count === 1 || count === 2));

assert.equal(stats.sourceSlideCount, 507);
assert.equal(stats.nonQuestionSlideCount, 24);
assert.equal(stats.uniqueQuestionCount, 483);
assert.equal(stats.sourceQuestionOccurrenceCount, 483);
assert.equal(stats.practiceAssignmentCount, 500);
assert.equal(stats.repeatedPracticeAssignmentCount, 17);
assert.equal(stats.examCount, 10);
assert.equal(stats.questionsPerExam, 50);
assert.equal(stats.topics.reduce((sum, topic) => sum + topic.uniqueQuestionCount, 0), 483);
assert.equal(stats.topics.reduce((sum, topic) => sum + topic.practiceAssignmentCount, 0), 500);
assert.equal(stats.repeatedForPractice.length, 17);
assert.equal(stats.verification["semantic-conflict"], 4);
assert.equal(stats.verification["semantic-uncertain"], 7);
assert.equal(stats.semanticAnswerReview.reviewedQuestionCount, 353);
assert.equal(stats.semanticAnswerReview.agreedQuestionCount, 342);
assert.equal(stats.semanticAnswerReview.conflictQuestionCount, 4);
assert.equal(stats.semanticAnswerReview.uncertainQuestionCount, 7);
assert.equal(stats.ocrCoverage.questionTextCount, 483);
assert.equal(stats.ocrCoverage.optionsCount, 483);
assert.ok(stats.topics.every((topic) => topic.advice?.trim().length >= 20));
assert.deepEqual(
  stats.repeatedForPractice.map((item) => item.id).toSorted(),
  Object.entries(assignmentCounts)
    .filter(([, count]) => count === 2)
    .map(([id]) => id)
    .toSorted(),
);

assert.equal(sourceSummary.totalSlides, 507);
assert.equal(sourceSummary.nonQuestionSlides.length, 24);
assert.equal(new Set(sourceSummary.nonQuestionSlides).size, 24);
assert.equal(sourceSummary.questionCount, 483);
assert.equal(sourceSummary.questionCount + sourceSummary.nonQuestionSlides.length, 507);

assert.equal(manifest.sourceQuestionCount, 483);
assert.equal(manifest.expectedAssetCount, 483);
assert.equal(manifest.assets.length, 483);
assert.equal(new Set(manifest.assets.map((asset) => asset.questionId)).size, 483);
assert.equal(manifest.presentAssetCount + manifest.missingAssetCount, 483);
assert.ok(manifest.assets.filter((asset) => asset.present).every((asset) => asset.dimensions));

const report = {
  schemaVersion: 2,
  passed: true,
  accounting: {
    deckSlides: 507,
    realQuestions: 483,
    nonQuestionSlides: 24,
    practiceAssignments: 500,
    repeatedPracticeAssignments: 17,
  },
  schema: {
    multiAnswerQuestions: questions.filter((question) => question.responseMode === "multiple").length,
    usableQuestionTextCount: stats.ocrCoverage.questionTextCount,
    ocrQuestionTextCount: stats.ocrCoverage.ocrQuestionTextCount,
    noteFallbackQuestionCount: stats.ocrCoverage.noteFallbackQuestionCount,
    ocrOptionsCount: stats.ocrCoverage.optionsCount,
    imageAssetsPresent: manifest.presentAssetCount,
  },
  excludedSeparatorSlides: excludedSsg104Slides,
};

await writeFile(
  path.join(projectRoot, "data", "ssg", "validation-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log(
  `SSG library validation passed: 507 slides = 483 real questions + 24 non-question slides; 10×50 uses 17 explicit repeats.`,
);
