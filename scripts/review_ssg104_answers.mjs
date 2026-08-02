import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const notesPath = path.join(root, "data", "ssg104", "source-notes.json");
const ocrPath = path.join(root, "data", "ssg104", "ocr-combined.json");
const outputPath = path.join(root, "data", "ssg104", "audit", "answer-review.json");

const source = JSON.parse(fs.readFileSync(notesPath, "utf8"));
const ocr = JSON.parse(fs.readFileSync(ocrPath, "utf8"));
const notesBySlide = new Map(source.questions.map((item) => [item.sourceSlide, item]));

const conflicts = new Map([
  [
    106,
    {
      proposedAnswerLetters: ["C"],
      reason:
        "The keyed B names body-language usage, not an action that logically comes first before an interview. Reading the job description carefully (C) is the prerequisite preparation step. The accompanying note paragraph is about multicultural cognitive complexity and does not support B, which further indicates a source-note/key mismatch.",
    },
  ],
  [
    337,
    {
      proposedAnswerLetters: ["A", "B", "C"],
      reason:
        "A-C are chronic-stress symptoms. D says stress enhances memory and concentration, which is the opposite of the usual chronic-stress effect. The item asks for four selections but exposes only four choices, so the source item is internally defective as well as semantically inconsistent with keyed ABCD.",
    },
  ],
  [
    347,
    {
      proposedAnswerLetters: ["D"],
      reason:
        "A request for confirmation or clarification, usually phrased as a question, is probing feedback (D). Interpretive feedback (keyed B) paraphrases or explains the receiver's interpretation instead.",
    },
  ],
  [
    357,
    {
      proposedAnswerLetters: ["A", "B", "D"],
      reason:
        "The prompt explicitly requests three attributes. Imaginative (A), curious (B), and optimistic (D) are creative-thinker attributes; sluggish and imitative are not. The single-letter key A is incomplete.",
    },
  ],
]);

const uncertain = new Map([
  [
    74,
    {
      plausibleAnswerLetters: [["B"], ["B", "D"]],
      reason:
        "B is the direct definition of an informal leader. D describes empowerment in high-involvement organizations and may be course-specific context rather than an intrinsic defining characteristic; the wording alone does not settle whether D belongs.",
    },
  ],
  [
    75,
    {
      plausibleAnswerLetters: [["A", "D"], ["A", "C"], ["A", "C", "D"]],
      reason:
        "A and D map to applying and analyzing, but C (relating abstract ideas to practical situations) also describes college-level application. The two-choice limit leaves more than two semantically plausible statements.",
    },
  ],
  [
    76,
    {
      plausibleAnswerLetters: [["A", "B"], ["A", "B", "D"]],
      reason:
        "A and B are standard uses of logic, but examining underlying reasons (D) is also ordinarily part of logical analysis. The course may distinguish logic from broader critical-thinking practice, but the item does not state that distinction.",
    },
  ],
  [
    78,
    {
      plausibleAnswerLetters: [["A", "C"]],
      reason:
        "The mapping of named technologies to the Understanding level of Bloom's taxonomy is curriculum-specific. The keyed A/C pair is possible, but it cannot be established from the option wording alone without the referenced course matrix.",
    },
  ],
  [
    82,
    {
      plausibleAnswerLetters: [["A", "B"], ["C", "D"]],
      reason:
        "A/B give broad psychological and social need categories, while C/D give recognizable specific benefits of group membership. Because the prompt asks generally why people join groups, both abstraction levels are plausible.",
    },
  ],
  [
    195,
    {
      plausibleAnswerLetters: [["B"]],
      reason:
        "The OCR/source stem is grammatically incomplete and appears to omit the relationship between its two clauses. B is consistent with performance and ability comparisons, but the damaged stem prevents an independent semantic confirmation.",
    },
  ],
  [
    284,
    {
      plausibleAnswerLetters: [["A"]],
      reason:
        "A is the only clearly appropriate visible response, yet the prompt explicitly says there is more than one answer and the notes contain only A. Either another correct choice is missing or the multi-answer instruction is erroneous.",
    },
  ],
]);

function selectedOptions(item, note) {
  return note.answerLetters.map((letter) => {
    const option = item.options.find((candidate) => candidate.letter === letter);
    return { letter, text: option?.text ?? null };
  });
}

function detailFor(slide, review) {
  const item = ocr.find((candidate) => candidate.sourceSlide === slide);
  const note = notesBySlide.get(slide);
  if (!item || !note) throw new Error(`Missing slide ${slide} in OCR or notes data`);
  return {
    sourceSlide: slide,
    id: note.id,
    questionText: item.questionText,
    keyedAnswerLetters: note.answerLetters,
    keyedSelectedOptions: selectedOptions(item, note),
    options: item.options,
    sourceEvidence: {
      notes: note.notes,
      image: item.image,
      ocrConfidence: item.confidence,
      ocrFlags: item.flags,
    },
    ...review,
  };
}

const excluded = ocr.filter((item) => item.isQuestion === false);
const included = ocr.filter((item) => item.isQuestion === true);
const excludedSlides = excluded.map((item) => item.sourceSlide);
const reviewedSlides = included.map((item) => item.sourceSlide);
const answerCodeOnlySlides = included
  .filter((item) => {
    const note = notesBySlide.get(item.sourceSlide);
    return note?.answerLetters?.length > 0 && !note.correctAnswer;
  })
  .map((item) => item.sourceSlide);
const multiAnswerSlides = included
  .filter((item) => (notesBySlide.get(item.sourceSlide)?.answerLetters?.length ?? 0) > 1)
  .map((item) => item.sourceSlide);
const ocrFlaggedSlides = included
  .filter(
    (item) =>
      item.confidence !== "high" ||
      item.flags?.length > 0 ||
      !item.questionText ||
      item.optionCount < 2,
  )
  .map((item) => item.sourceSlide);
const semanticFocusSlides = [
  ...new Set([...answerCodeOnlySlides, ...multiAnswerSlides, ...ocrFlaggedSlides]),
].sort((a, b) => a - b);

for (const item of included) {
  const note = notesBySlide.get(item.sourceSlide);
  if (!note) throw new Error(`Missing speaker-note record for slide ${item.sourceSlide}`);
  if (!note.answerLetters?.length) {
    throw new Error(`Question slide ${item.sourceSlide} has no answer letter`);
  }
  for (const letter of note.answerLetters) {
    if (!item.options.some((option) => option.letter === letter)) {
      throw new Error(`Slide ${item.sourceSlide} answer ${letter} has no OCR option`);
    }
  }
}

for (const slide of [...conflicts.keys(), ...uncertain.keys()]) {
  if (!reviewedSlides.includes(slide)) throw new Error(`Reviewed exception ${slide} is not a question`);
}

const conflictSlides = [...conflicts.keys()].sort((a, b) => a - b);
const uncertainSlides = [...uncertain.keys()].sort((a, b) => a - b);
const agreedSlides = reviewedSlides.filter(
  (slide) => !conflicts.has(slide) && !uncertain.has(slide),
);
const structuralPlusNotesSlides = reviewedSlides.filter(
  (slide) => !semanticFocusSlides.includes(slide),
);

const audit = {
  auditVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: {
    subject: "SSG104",
    sourceNotes: "data/ssg104/source-notes.json",
    ocrQuestions: "data/ssg104/ocr-combined.json",
    totalSourceRecords: ocr.length,
    excludedNonQuestionCount: excludedSlides.length,
    excludedNonQuestionSlides: excludedSlides,
    reviewedCount: reviewedSlides.length,
  },
  method: {
    classification:
      "agreed means the slide key is structurally valid and no contradiction was found; conflict means visible option semantics contradict or incompletely satisfy the key; uncertain means the wording/course context does not support a unique independent decision.",
    semanticFocusedReview:
      "Every answer-code-only slide, every multi-answer slide, and every OCR-flagged slide was read as a question with its full OCR options and keyed letters. Common domain definitions and internal wording constraints (NOT/EXCEPT, requested selection count, selected option meaning) were used as independent evidence.",
    structuralReviewForRemainder:
      "For the remaining slides, each keyed letter/index was checked to exist in the OCR option set. The speaker-note answer text/explanation already extracted from the source was used as supporting semantic evidence. This is not claimed as a fresh expert re-solution of every routine item.",
    sourcePriority:
      "The audit preserves the source key and reports disagreements; it does not mutate answers. Visible source image and OCR option text take priority when identifying contradictions. Proposed answers are review recommendations only.",
    limitations: [
      "No external answer manual was available.",
      "Some questions are course-specific or awkwardly translated, so those are marked uncertain instead of silently overriding the slide key.",
      "OCR confidence is high for all included records, but image paths remain attached to every exception for visual re-checking.",
    ],
  },
  coverage: {
    reviewedSlides,
    semanticFocusCount: semanticFocusSlides.length,
    semanticFocusSlides,
    answerCodeOnlyCount: answerCodeOnlySlides.length,
    answerCodeOnlySlides,
    multiAnswerCount: multiAnswerSlides.length,
    multiAnswerSlides,
    ocrFlaggedCount: ocrFlaggedSlides.length,
    ocrFlaggedSlides,
    structuralPlusNotesCount: structuralPlusNotesSlides.length,
    structuralPlusNotesSlides,
  },
  summary: {
    reviewedCount: reviewedSlides.length,
    agreedCount: agreedSlides.length,
    conflictCount: conflictSlides.length,
    uncertainCount: uncertainSlides.length,
    countsBalance: agreedSlides.length + conflictSlides.length + uncertainSlides.length,
    agreedSlides,
    conflictSlides,
    uncertainSlides,
  },
  conflicts: conflictSlides.map((slide) => detailFor(slide, conflicts.get(slide))),
  uncertain: uncertainSlides.map((slide) => detailFor(slide, uncertain.get(slide))),
};

if (audit.scope.excludedNonQuestionCount !== 15) {
  throw new Error(`Expected 15 non-question slides, got ${audit.scope.excludedNonQuestionCount}`);
}
if (audit.summary.reviewedCount !== 353) {
  throw new Error(`Expected 353 reviewed questions, got ${audit.summary.reviewedCount}`);
}
if (audit.summary.countsBalance !== audit.summary.reviewedCount) {
  throw new Error("Review classification counts do not balance");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: path.relative(root, outputPath),
      reviewedCount: audit.summary.reviewedCount,
      agreedCount: audit.summary.agreedCount,
      conflictCount: audit.summary.conflictCount,
      uncertainCount: audit.summary.uncertainCount,
      semanticFocusCount: audit.coverage.semanticFocusCount,
    },
    null,
    2,
  ),
);
