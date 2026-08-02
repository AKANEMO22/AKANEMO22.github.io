import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "data", "ssg");
const SSG104_NON_QUESTION_SLIDES = new Set([
  20, 55, 63, 72, 83, 86, 90, 122, 148, 156, 216, 249, 288, 319, 332,
]);

async function readJson(relativePath, { optional = false } = {}) {
  try {
    const raw = await readFile(path.join(projectRoot, relativePath), "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw error;
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function capitalizeFirstLetter(value) {
  return normalizeText(value).replace(
    /^([“”'"(\[]*)(\p{Ll})/u,
    (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("vi")}`,
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAnswerLetters(raw) {
  const candidates = Array.isArray(raw.answerLetters)
    ? raw.answerLetters
    : [raw.answerLetter];
  return unique(
    candidates.flatMap((value) =>
      String(value ?? "")
        .toUpperCase()
        .match(/[A-F]/g) ?? [],
    ),
  ).toSorted();
}

function optionIndex(letter) {
  return letter.charCodeAt(0) - 65;
}

function parseOcrLines(lines = []) {
  const ordered = lines
    .filter((line) => normalizeText(line?.text))
    .toSorted((left, right) => (left.y ?? 0) - (right.y ?? 0) || (left.x ?? 0) - (right.x ?? 0));
  const labelCandidates = ordered.flatMap((line, index) => {
    const text = normalizeText(line.text);
    const strong = text.match(/^([A-F])\s*[.)_\-:]\s*(.*)$/i);
    if (strong) {
      return [{ index, letter: strong[1].toUpperCase(), text: normalizeText(strong[2]), strong: true }];
    }
    const standalone = text.match(/^([A-F])$/i);
    if (standalone) {
      return [{ index, letter: standalone[1].toUpperCase(), text: "", strong: true }];
    }
    const weak = text.match(/^([A-F])\s+(.+)$/i);
    return weak
      ? [{ index, letter: weak[1].toUpperCase(), text: normalizeText(weak[2]), strong: false }]
      : [];
  });

  const paths = labelCandidates
    .filter((candidate) => candidate.letter === "A")
    .map((first) => {
      const path = [first];
      let previous = first;
      for (let code = 66; code <= 70; code += 1) {
        const letter = String.fromCharCode(code);
        const next = labelCandidates.find(
          (candidate) => candidate.letter === letter && candidate.index > previous.index,
        );
        if (!next) break;
        path.push(next);
        previous = next;
      }
      return path;
    })
    .filter((path) => path.length >= 2)
    .toSorted((left, right) => {
      const score = (path) =>
        path.length * 10_000 +
        path.filter((candidate) => candidate.strong).length * 100 -
        (path.at(-1).index - path[0].index);
      return score(right) - score(left);
    });

  const selected = paths[0] ?? [];
  if (!selected.length) {
    return { question: normalizeText(ordered.map((line) => line.text).join(" ")), options: [], detectedOptionLetters: [] };
  }

  const question = normalizeText(
    ordered.slice(0, selected[0].index).map((line) => line.text).join(" "),
  );
  const options = selected.map((candidate, position) => {
    const end = selected[position + 1]?.index ?? ordered.length;
    return normalizeText([
      candidate.text,
      ...ordered.slice(candidate.index + 1, end).map((line) => line.text),
    ].join(" "));
  });
  const letters = selected.map((candidate) => candidate.letter);
  return {
    question,
    options,
    detectedOptionLetters: letters,
  };
}

function parseInlineOcrLines(lines = []) {
  const orderedText = normalizeText(
    lines
      .filter((line) => normalizeText(line?.text))
      .toSorted((left, right) => (left.y ?? 0) - (right.y ?? 0) || (left.x ?? 0) - (right.x ?? 0))
      .map((line) => line.text)
      .join(" "),
  );
  const labels = [...orderedText.matchAll(/(?:^|\s)([A-F])\s*[.)_\-:]\s*/gi)].map((match) => ({
    letter: match[1].toUpperCase(),
    start: match.index + (match[0].startsWith(" ") ? 1 : 0),
    contentStart: match.index + match[0].length,
  }));
  const starts = labels.filter((label) => label.letter === "A");
  const paths = starts
    .map((first) => {
      const path = [first];
      let previous = first;
      for (let code = 66; code <= 70; code += 1) {
        const letter = String.fromCharCode(code);
        const next = labels.find((label) => label.letter === letter && label.start > previous.start);
        if (!next) break;
        path.push(next);
        previous = next;
      }
      return path;
    })
    .toSorted((left, right) => right.length - left.length || left[0].start - right[0].start);
  const selected = paths[0] ?? [];
  if (!selected.length) return { question: orderedText, options: [], detectedOptionLetters: [] };
  return {
    question: normalizeText(orderedText.slice(0, selected[0].start)),
    options: selected.map((label, index) =>
      normalizeText(orderedText.slice(label.contentStart, selected[index + 1]?.start ?? orderedText.length)),
    ),
    detectedOptionLetters: selected.map((label) => label.letter),
  };
}

function projection(value) {
  const characters = [];
  const sourceIndexes = [];
  [...normalizeText(value)].forEach((character, index) => {
    if (/[a-z0-9]/i.test(character)) {
      characters.push(character.toLowerCase());
      sourceIndexes.push(index);
    }
  });
  return { text: characters.join(""), sourceIndexes };
}

function alignment(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      rows[leftIndex][rightIndex] = Math.min(
        rows[leftIndex - 1][rightIndex] + 1,
        rows[leftIndex][rightIndex - 1] + 1,
        rows[leftIndex - 1][rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
  }
  let leftIndex = left.length;
  let rightIndex = right.length;
  const pairs = [];
  while (leftIndex || rightIndex) {
    if (
      leftIndex &&
      rightIndex &&
      rows[leftIndex][rightIndex] ===
        rows[leftIndex - 1][rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
    ) {
      pairs.push([leftIndex - 1, rightIndex - 1]);
      leftIndex -= 1;
      rightIndex -= 1;
    } else if (leftIndex && rows[leftIndex][rightIndex] === rows[leftIndex - 1][rightIndex] + 1) {
      leftIndex -= 1;
    } else {
      rightIndex -= 1;
    }
  }
  return { distance: rows[left.length][right.length], pairs: pairs.reverse() };
}

function textSimilarity(left, right) {
  const leftText = projection(left).text;
  const rightText = projection(right).text;
  if (!leftText || !rightText) return 0;
  const { distance } = alignment(leftText, rightText);
  return 1 - distance / Math.max(leftText.length, rightText.length, 1);
}

function candidateScore(candidate, requiredOptionCount) {
  if (!candidate) return Number.NEGATIVE_INFINITY;
  const fields = [candidate.question, ...candidate.options.slice(0, requiredOptionCount)];
  const missing = fields.filter((field) => !field).length;
  const wordBoundaryBonus = fields.reduce(
    (sum, field) => sum + Math.min(18, (normalizeText(field).match(/\s/g) ?? []).length),
    0,
  );
  const suspicious = fields.reduce(
    (sum, field) =>
      sum +
      (normalizeText(field).match(/(?:^|\s)[A-F][._]\s|[%•�]|\b(?:ttE|TTE|VVh|V%|nmat)\b/gi) ?? []).length,
    0,
  );
  return (
    candidate.options.slice(0, requiredOptionCount).filter(Boolean).length * 2_000 +
    (candidate.question ? 1_500 : 0) +
    wordBoundaryBonus * 12 -
    missing * 5_000 -
    suspicious * 300
  );
}

function restoreSpacing(accurateValue, guideValue) {
  const accurate = normalizeText(accurateValue);
  const guide = normalizeText(guideValue);
  if (!accurate) return guide;
  if (!guide) return accurate;
  const accurateProjection = projection(accurate);
  const guideProjection = projection(guide);
  const lengthRatio = accurateProjection.text.length / Math.max(guideProjection.text.length, 1);
  const match = alignment(accurateProjection.text, guideProjection.text);
  const similarity = 1 - match.distance / Math.max(accurateProjection.text.length, guideProjection.text.length, 1);
  if (similarity < 0.62 || lengthRatio < 0.72 || lengthRatio > 1.28) return guide;

  const guideToAccurate = new Map(match.pairs.map(([accurateIndex, guideIndex]) => [guideIndex, accurateIndex]));
  const boundaries = [];
  let projectedIndex = 0;
  for (let sourceIndex = 0; sourceIndex < guide.length; sourceIndex += 1) {
    if (/[a-z0-9]/i.test(guide[sourceIndex])) projectedIndex += 1;
    if (!/\s/.test(guide[sourceIndex]) || projectedIndex === 0) continue;
    let nextGuideIndex = projectedIndex;
    while (nextGuideIndex < guideProjection.text.length && !guideToAccurate.has(nextGuideIndex)) {
      nextGuideIndex += 1;
    }
    const nextAccurateIndex = guideToAccurate.get(nextGuideIndex);
    if (nextAccurateIndex != null) {
      boundaries.push(accurateProjection.sourceIndexes[nextAccurateIndex]);
    }
  }

  const characters = [];
  const sourceToCompact = new Map();
  for (let sourceIndex = 0; sourceIndex < accurate.length; sourceIndex += 1) {
    if (/\s/.test(accurate[sourceIndex])) continue;
    sourceToCompact.set(sourceIndex, characters.length);
    characters.push(accurate[sourceIndex]);
  }
  const insertions = new Set(
    boundaries.map((sourceIndex) => sourceToCompact.get(sourceIndex)).filter((index) => index > 0),
  );
  return characters
    .map((character, index) => `${insertions.has(index) ? " " : ""}${character}`)
    .join("")
    .replace(/\s+([,.;:!?\)])/g, "$1")
    .replace(/([\(“‘])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function fuseField(guide, candidates) {
  const normalizedGuide = normalizeText(guide);
  const alternatives = candidates
    .map((candidate, priority) => ({
      text: normalizeText(candidate),
      priority,
      similarity: textSimilarity(candidate, normalizedGuide),
    }))
    .filter((candidate) => candidate.text)
    .toSorted(
      (left, right) =>
        right.similarity - left.similarity || left.priority - right.priority,
    );
  const accurate = alternatives.find((candidate) => candidate.similarity >= 0.62)?.text;
  return restoreSpacing(accurate, normalizedGuide) || normalizedGuide || alternatives[0]?.text || "";
}

function rapidOcrCandidates(record) {
  if (!record) return [];
  return [
    { ...parseOcrLines(record.passOriginal), engine: "rapid-original" },
    { ...parseOcrLines(record.passThresholded), engine: "rapid-thresholded" },
  ].filter((candidate) => candidate.question || candidate.options.some(Boolean));
}

function auditOcrCandidate(record) {
  const ocr = record?.ocr;
  if (!ocr) return null;
  const optionPairs = Array.isArray(ocr.options) ? ocr.options : [];
  const maximumIndex = Math.max(-1, ...optionPairs.map((option) => optionIndex(String(option.letter).toUpperCase())));
  return {
    question: normalizeText(ocr.questionText),
    options: Array.from({ length: maximumIndex + 1 }, (_, index) => {
      const letter = String.fromCharCode(65 + index);
      const text = normalizeText(
        optionPairs.find((option) => String(option.letter).toUpperCase() === letter)?.text,
      );
      const followingLetters = Array.from(
        { length: Math.max(0, 5 - index) },
        (_, offset) => String.fromCharCode(66 + index + offset),
      ).join("");
      return followingLetters
        ? normalizeText(text.replace(new RegExp(`\\s+[${followingLetters}][,.]\\s+.*$`, "i"), ""))
        : text;
    }),
    detectedOptionLetters: unique(optionPairs.map((option) => String(option.letter).toUpperCase())).toSorted(),
  };
}

function combinedOcrCandidate(record) {
  if (!record?.isQuestion) return null;
  const optionPairs = Array.isArray(record.options) ? record.options : [];
  const maximumIndex = Math.max(-1, ...optionPairs.map((option) => optionIndex(String(option.letter).toUpperCase())));
  return {
    question: normalizeText(record.questionText),
    options: Array.from({ length: maximumIndex + 1 }, (_, index) => {
      const letter = String.fromCharCode(65 + index);
      return normalizeText(optionPairs.find((option) => String(option.letter).toUpperCase() === letter)?.text);
    }),
    detectedOptionLetters: unique(optionPairs.map((option) => String(option.letter).toUpperCase())).toSorted(),
  };
}

function windowsOcrCandidate(record) {
  if (!record?.lines) return null;
  return { ...parseOcrLines(record.lines), engine: "windows-spatial" };
}

function englishOcrCandidate(record, requiredOptionCount, fallbackCandidates) {
  if (!record?.passes) return null;
  const candidates = record.passes.flatMap((lines) => [
    { ...parseOcrLines(lines), engine: "english-spatial" },
    { ...parseInlineOcrLines(lines), engine: "english-inline" },
  ]);
  const complete = candidates
    .filter(
      (candidate) =>
        candidate.question &&
        candidate.options.length >= requiredOptionCount &&
        candidate.options.slice(0, requiredOptionCount).every(Boolean),
    )
    .toSorted(
      (left, right) =>
        candidateScore(right, requiredOptionCount) - candidateScore(left, requiredOptionCount) ||
        [right.question, ...right.options].join(" ").length -
          [left.question, ...left.options].join(" ").length,
    )[0];
  if (complete) return { ...complete, engine: "english-complete" };

  const allCandidates = [...candidates, ...fallbackCandidates.filter(Boolean)];
  const cleanQuestions = allCandidates
    .map((candidate) => normalizeText(candidate.question))
    .filter(
      (question) =>
        question.length >= 12 &&
        !(question.match(/(?:^|\s)[A-F][.)_:-]\s/g) ?? []).length,
    )
    .toSorted((left, right) => right.length - left.length);
  const options = Array.from({ length: Math.max(requiredOptionCount, ...allCandidates.map((candidate) => candidate.options.length)) }, (_, index) => {
    const choices = allCandidates
      .map((candidate, priority) => ({ text: normalizeText(candidate.options[index]), priority }))
      .filter(
        (choice) =>
          choice.text &&
          !(choice.text.match(/(?:^|\s)[A-F][.)_:-]\s/g) ?? []).length,
      )
      .toSorted((left, right) => left.priority - right.priority || right.text.length - left.text.length);
    return choices[0]?.text ?? "";
  });
  return {
    question: cleanQuestions[0] ?? "",
    options,
    detectedOptionLetters: options.map((_, index) => String.fromCharCode(65 + index)),
    engine: "english-field-merge",
  };
}

function bestOcrCandidate(
  correctionRecord,
  combinedRecord,
  auditRecord,
  rapidRecord,
  windowsRecord,
  englishRecord,
  requiredOptionCount,
) {
  const correction = combinedOcrCandidate(correctionRecord);
  if (correction) return { ...correction, engine: "manual-correction" };

  const combined = combinedOcrCandidate(combinedRecord);
  if (combined) return { ...combined, engine: "combined-reviewed" };

  const rapid = rapidOcrCandidates(rapidRecord);
  const windows = windowsOcrCandidate(windowsRecord);
  const audit = auditOcrCandidate(auditRecord);
  const candidates = [windows, ...rapid, audit].filter(Boolean);
  const english = englishOcrCandidate(englishRecord, requiredOptionCount, candidates);
  if (
    english?.question &&
    english.options.length >= requiredOptionCount &&
    english.options.slice(0, requiredOptionCount).every(Boolean)
  ) {
    return english;
  }
  const guide = candidates.toSorted(
    (left, right) => candidateScore(right, requiredOptionCount) - candidateScore(left, requiredOptionCount),
  )[0];
  if (!guide) return null;

  const original = rapid.find((candidate) => candidate.engine === "rapid-original");
  const thresholded = rapid.find((candidate) => candidate.engine === "rapid-thresholded");
  const maximumOptionCount = Math.max(requiredOptionCount, ...candidates.map((candidate) => candidate.options.length));
  return {
    question: fuseField(guide.question, [original?.question, thresholded?.question, windows?.question, audit?.question]),
    options: Array.from({ length: maximumOptionCount }, (_, index) =>
      fuseField(guide.options[index], [
        original?.options[index],
        thresholded?.options[index],
        windows?.options[index],
        audit?.options[index],
      ]),
    ),
    detectedOptionLetters: Array.from(
      { length: maximumOptionCount },
      (_, index) => String.fromCharCode(65 + index),
    ),
    engine: `fused:${guide.engine}`,
  };
}

async function loadOcr(subject) {
  const subjectKey = subject.toLowerCase();
  const independentReview = await readJson(
    "data/ssg/audit/ocr-independent-review.json",
    { optional: true },
  );
  const rapid =
    (await readJson(`data/${subjectKey}/ocr-raw/rapidocr.json`, { optional: true })) ?? [];
  const audit = await readJson(`data/${subjectKey}/audit/ocr-asset-audit.json`, {
    optional: true,
  });
  const combined =
    (await readJson(`data/${subjectKey}/ocr-combined.json`, { optional: true })) ?? [];
  const corrections = await readJson(`data/${subjectKey}/ocr-corrections.json`, {
    optional: true,
  });
  const windows = await readJson(`data/${subjectKey}/ocr-raw/windows.json`, {
    optional: true,
  });
  const english = await readJson(`data/${subjectKey}/ocr-raw/english.json`, {
    optional: true,
  });
  const independentCorrections = (independentReview?.records ?? [])
    .filter(
      (record) =>
        record.subject === subject &&
        (record.changed?.question || record.changed?.optionIndexes?.length),
    )
    .map((record) => ({
      sourceSlide: record.sourceSlide,
      isQuestion: true,
      questionText: record.correctedQuestion,
      options: record.correctedOptions.map((text, index) => ({
        letter: String.fromCharCode(65 + index),
        text,
      })),
      independentReview: {
        id: record.id,
        confidence: record.confidence,
        evidence: record.evidence,
      },
    }));
  return {
    rapidBySlide: new Map(rapid.map((record) => [record.sourceSlide, record])),
    auditBySlide: new Map((audit?.records ?? []).map((record) => [record.sourceSlide, record])),
    combinedBySlide: new Map(combined.map((record) => [record.sourceSlide, record])),
    correctionBySlide: new Map(
      (corrections?.corrections ?? []).map((record) => [record.sourceSlide, record]),
    ),
    windowsBySlide: new Map((windows ?? []).map((record) => [record.sourceSlide, record])),
    englishBySlide: new Map((english ?? []).map((record) => [record.sourceSlide, record])),
    independentCorrectionBySlide: new Map(
      independentCorrections.map((record) => [record.sourceSlide, record]),
    ),
  };
}

const TOPIC_RULES = [
  [/report|báo cáo|planning checklist|outline|research|nghiên cứu|plagiarism|đạo văn/i, "Viết & nghiên cứu"],
  [/meeting|cuộc họp|biên bản|agenda|action item/i, "Tổ chức cuộc họp"],
  [/email|memo|business letter|proposal|thư thương mại|subject line|text message/i, "Giao tiếp kinh doanh"],
  [/résumé|resume|interview|phỏng vấn|career|nghề nghiệp|thực tập|transferable skill/i, "Nghề nghiệp & tuyển dụng"],
  [/presentation|thuyết trình|persuasive|pathos|ethos|logos|maslow|monroe|audience|khán giả/i, "Thuyết trình thuyết phục"],
  [/nonverbal|phi ngôn ngữ|paralanguage|eye contact|ánh mắt|gesture|cử chỉ/i, "Giao tiếp phi ngôn ngữ"],
  [/conflict|xung đột|feedback|phản hồi|face-saving|dewey|problem solving|giải quyết vấn đề/i, "Giải quyết vấn đề & xung đột"],
  [/leader|lãnh đạo|manager|quản lý|influence|ảnh hưởng|integrity|chính trực|coach/i, "Lãnh đạo & quản lý"],
  [/team|group|nhóm|psychological safety|trust|tin tưởng|cohesiveness|gắn kết/i, "Làm việc nhóm"],
];

const STUDY_ADVICE = {
  "Viết & nghiên cứu": "Ôn cấu trúc báo cáo, quy trình nghiên cứu, cách lập dàn ý và quy tắc tránh đạo văn.",
  "Tổ chức cuộc họp": "Nắm agenda, ground rules, vai trò điều phối, biên bản và action items có người phụ trách.",
  "Giao tiếp kinh doanh": "Phân biệt email, memo, thư thương mại và proposal theo mục đích, đối tượng và văn phong.",
  "Nghề nghiệp & tuyển dụng": "Ôn résumé, STAR, kỹ năng chuyển giao, chuẩn bị phỏng vấn và phát triển nghề nghiệp.",
  "Thuyết trình thuyết phục": "Học Ethos–Pathos–Logos, phân tích khán giả, Monroe và tháp nhu cầu Maslow.",
  "Giao tiếp phi ngôn ngữ": "Nhớ vai trò của ánh mắt, cử chỉ, tư thế, cao độ, tốc độ và nhịp điệu khi nói.",
  "Giải quyết vấn đề & xung đột": "Ôn quy trình Dewey, phản hồi hướng mục tiêu, face-saving và các kiểu xử lý xung đột.",
  "Lãnh đạo & quản lý": "Tập trung vào ảnh hưởng, chính trực, coaching, tự chủ và trách nhiệm giải trình.",
  "Làm việc nhóm": "Ưu tiên trust equation, psychological safety, mục tiêu chung, gắn kết và trách nhiệm chung.",
  "Kiến thức tổng hợp": "Ôn theo ảnh gốc và lời giải, đồng thời gom các câu còn thiếu OCR để kiểm tra chéo.",
};

function topicFor(question) {
  const text = [question.question, question.questionVi, ...question.options, question.correctAnswer, question.explanation]
    .join(" ");
  return TOPIC_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "Kiến thức tổng hợp";
}

function verificationFor(subject, raw, canonical, ocr) {
  if (subject === "SSG105" && canonical?.verification) {
    return {
      ...canonical.verification,
      answerVerified: true,
      contentVerified: Boolean(ocr?.question && ocr.options.filter(Boolean).length >= 2),
      ocrAvailable: Boolean(ocr),
      issues: ocr?.question && ocr.options.filter(Boolean).length >= 2 ? [] : ["missing-ocr-text"],
    };
  }

  const answerLetters = normalizeAnswerLetters(raw);
  const hasAnswer = answerLetters.length > 0;
  const completeNotes = Boolean(raw.verifiedFromNotes);
  const hasOcrContent = Boolean(ocr?.question && ocr.options.filter(Boolean).length >= 2);
  return {
    status: completeNotes ? "verified" : hasAnswer ? "answer-code-only" : "needs-review",
    confidence: completeNotes ? 0.9 : hasAnswer ? 0.72 : 0,
    answerVerified: completeNotes,
    contentVerified: hasOcrContent,
    ocrAvailable: Boolean(ocr),
    evidence: unique([
      hasAnswer && "speaker-note-answer-code",
      "independent-extraction-audit",
      hasOcrContent && "image-ocr",
    ]),
    reviewedBy: ["ssg104-notes-extraction-agent"],
    issues: unique([
      !hasAnswer && "missing-answer-code",
      !normalizeText(raw.questionVi) && "missing-note-question",
      !normalizeText(raw.explanationVi) && "missing-note-explanation",
      !hasOcrContent && "missing-ocr-text",
    ]),
  };
}

const [
  ssg104Source,
  ssg105Source,
  ssg105Canonical,
  ssg104AnswerReview,
  ssg104Ocr,
  ssg105Ocr,
  viTranslations,
  reviewedViTranslations,
  answerReviewV2,
] = await Promise.all([
  readJson("data/ssg104/source-notes.json"),
  readJson("data/ssg105/source-notes.json"),
  readJson("data/ssg105/questions.json"),
  readJson("data/ssg104/audit/answer-review.json"),
  loadOcr("SSG104"),
  loadOcr("SSG105"),
  readJson("data/ssg/translations-vi.json", { optional: true }),
  readJson("data/ssg/audit/translations-vi-reviewed.json", { optional: true }),
  readJson("data/ssg/audit/answer-multiselect-review-v2.json", { optional: true }),
]);

const canonical105BySlide = new Map(ssg105Canonical.map((question) => [question.sourceSlide, question]));
const viTranslationById = new Map(
  (viTranslations?.translations ?? []).map((translation) => [translation.id, translation]),
);
const reviewedViTranslationById = new Map(
  (reviewedViTranslations?.translations ?? []).map((translation) => [translation.id, translation]),
);
const answerReviewV2ById = new Map(
  (answerReviewV2?.records ?? []).map((record) => [record.id, record]),
);
function shouldApplyReviewedAnswer(record) {
  return Boolean(
    record?.proposedAnswerLetters?.length &&
      ((record.verdict === "semantic-conflict" && record.confidence >= 0.9) ||
        record.id === "SSG104-S284"),
  );
}
const ANSWER_CORRECTION_EXPLANATIONS_VI = {
  "SSG104-S106":
    "Trước buổi phỏng vấn, việc cần làm đầu tiên là đọc kỹ mô tả công việc để hiểu yêu cầu của vị trí. Ngôn ngữ cơ thể được sử dụng trong lúc phỏng vấn, còn theo dõi kết quả diễn ra sau phỏng vấn.",
  "SSG104-S284":
    "Lùi lại giúp tái lập khoảng cách cá nhân; khoanh tay cũng có thể tạo tín hiệu phi ngôn ngữ về ranh giới. Phớt lờ hoặc chỉ im lặng không giúp tái lập hay truyền đạt ranh giới đó.",
  "SSG104-S337":
    "Các vấn đề về giấc ngủ, cân nặng và tiêu hóa đều là triệu chứng thường gặp của căng thẳng kéo dài. Phương án D nói căng thẳng làm tăng trí nhớ và khả năng tập trung, trái với tác động thông thường của căng thẳng mãn tính.",
  "SSG104-S347":
    "Phản hồi thăm dò (probing feedback) yêu cầu người nói xác nhận hoặc làm rõ thông điệp và thường được diễn đạt dưới dạng câu hỏi. Phản hồi diễn giải chủ yếu nhắc lại cách người nghe hiểu thông điệp.",
  "SSG104-S357":
    "Người có tư duy sáng tạo thường giàu trí tưởng tượng, tò mò và lạc quan. Chậm chạp và bắt chước không phải là các đặc điểm được hỏi.",
};
const semanticReview104BySlide = new Map([
  ...ssg104AnswerReview.conflicts.map((record) => [
    record.sourceSlide,
    { ...record, status: "semantic-conflict" },
  ]),
  ...ssg104AnswerReview.uncertain.map((record) => [
    record.sourceSlide,
    { ...record, status: "semantic-uncertain" },
  ]),
]);
const sources = [
  {
    subject: "SSG104",
    source: {
      ...ssg104Source,
      questions: ssg104Source.questions.filter(
        (question) => !SSG104_NON_QUESTION_SLIDES.has(question.sourceSlide),
      ),
    },
    canonicalBySlide: new Map(),
    semanticReviewBySlide: semanticReview104BySlide,
    ocr: ssg104Ocr,
  },
  {
    subject: "SSG105",
    source: ssg105Source,
    canonicalBySlide: canonical105BySlide,
    semanticReviewBySlide: new Map(),
    ocr: ssg105Ocr,
  },
];

const questions = sources.flatMap(({ subject, source, canonicalBySlide, semanticReviewBySlide, ocr }) =>
  source.questions.map((raw, subjectIndex) => {
    const canonical = canonicalBySlide.get(raw.sourceSlide);
    const semanticReview = semanticReviewBySlide.get(raw.sourceSlide);
    const independentOcrCorrection = ocr.independentCorrectionBySlide.get(raw.sourceSlide);
    const ocrCorrection =
      independentOcrCorrection ?? ocr.correctionBySlide.get(raw.sourceSlide);
    const sourceAnswerLetters = normalizeAnswerLetters(raw);
    const reviewedAnswer = answerReviewV2ById.get(raw.id);
    const applyReviewedAnswer = shouldApplyReviewedAnswer(reviewedAnswer);
    const answerLetters = applyReviewedAnswer
      ? normalizeAnswerLetters({ answerLetters: reviewedAnswer.proposedAnswerLetters })
      : sourceAnswerLetters;
    const answerIndexes = answerLetters.map(optionIndex);
    const requiredOptionCount = Math.max(4, ...answerIndexes.map((index) => index + 1));
    const ocrText = bestOcrCandidate(
      ocrCorrection,
      ocr.combinedBySlide.get(raw.sourceSlide),
      ocr.auditBySlide.get(raw.sourceSlide),
      ocr.rapidBySlide.get(raw.sourceSlide),
      ocr.windowsBySlide.get(raw.sourceSlide),
      ocr.englishBySlide.get(raw.sourceSlide),
      requiredOptionCount,
    );
    const detectedOptions = ocrText?.options ?? [];
    const optionsAreUsable =
      detectedOptions.length >= requiredOptionCount &&
      detectedOptions.slice(0, requiredOptionCount).every(Boolean);
    const usableOcr = ocrText
      ? { ...ocrText, options: optionsAreUsable ? detectedOptions : [] }
      : null;
    const resolvedQuestionText =
      normalizeText(ocrText?.question) ||
      normalizeText(canonical?.questionEn) ||
      normalizeText(raw.questionVi);
    const resolvedOptions = usableOcr?.options ?? [];
    const reviewedViTranslation = reviewedViTranslationById.get(raw.id);
    const baseViTranslation = viTranslationById.get(raw.id);
    const reviewedViTranslationIsUsable = Boolean(
      reviewedViTranslation?.questionVi &&
        reviewedViTranslation?.optionsVi?.length === resolvedOptions.length &&
        reviewedViTranslation.optionsVi.every((option) => normalizeText(option)),
    );
    const viTranslation = reviewedViTranslationIsUsable
      ? reviewedViTranslation
      : baseViTranslation;
    const viTranslationMatchesSource = reviewedViTranslationIsUsable
      ? true
      : viTranslation?.question === resolvedQuestionText &&
        JSON.stringify(viTranslation?.options) === JSON.stringify(resolvedOptions);
    const resolvedOptionsVi = viTranslationMatchesSource
      ? viTranslation.optionsVi.map((option) => capitalizeFirstLetter(option))
      : [];
    const sourceCorrectAnswer =
      normalizeText(canonical?.correctAnswer) || normalizeText(raw.correctAnswer);
    const correctOptionTexts = answerIndexes
      .map((index) => usableOcr?.options[index])
      .filter(Boolean);
    const resolvedCorrectAnswer =
      correctOptionTexts
        .map((option, index) => `${answerLetters[index]}. ${option}`)
        .join("; ") ||
      sourceCorrectAnswer;
    const sourceExplanation =
      normalizeText(canonical?.explanationVi) || normalizeText(raw.explanationVi);
    const resolvedExplanation =
      (applyReviewedAnswer && ANSWER_CORRECTION_EXPLANATIONS_VI[raw.id]) ||
      sourceExplanation ||
      `Mã đáp án trong ghi chú nguồn: ${answerLetters.join(", ")}. ${correctOptionTexts.join("; ")}`.trim();
    const baseVerification = verificationFor(subject, raw, canonical, usableOcr);
    const verification = applyReviewedAnswer
      ? {
          ...baseVerification,
          status: "verified",
          confidence: reviewedAnswer.confidence,
          answerVerified: true,
          evidence: unique([
            ...baseVerification.evidence,
            "independent-semantic-answer-review-v2",
            reviewedAnswer.multiselectCrossReview && "second-independent-multiselect-review",
          ]),
          issues: unique([
            ...baseVerification.issues,
            "source-answer-key-corrected",
          ]),
          semanticReview: {
            status: "answer-key-corrected",
            keyedAnswerLetters: sourceAnswerLetters,
            proposedAnswerLetters: answerLetters,
            reason: reviewedAnswer.reason,
            correctionApplied: true,
          },
        }
      : semanticReview
      ? {
          ...baseVerification,
          status: semanticReview.status,
          confidence: semanticReview.status === "semantic-conflict" ? 0.35 : 0.55,
          answerVerified: false,
          evidence: unique([
            ...baseVerification.evidence,
            "independent-semantic-answer-review",
          ]),
          issues: unique([
            ...baseVerification.issues,
            semanticReview.status === "semantic-conflict"
              ? "semantic-answer-conflict"
              : "semantic-answer-uncertain",
          ]),
          semanticReview: {
            status: semanticReview.status,
            keyedAnswerLetters: semanticReview.keyedAnswerLetters,
            proposedAnswerLetters: semanticReview.proposedAnswerLetters ?? null,
            plausibleAnswerLetters: semanticReview.plausibleAnswerLetters ?? null,
            reason: semanticReview.reason,
          },
        }
      : baseVerification;
    const localImage = `/${subject.toLowerCase()}/source/slide-${String(raw.sourceSlide).padStart(4, "0")}.png`;
    const question = {
      schemaVersion: 2,
      id: raw.id,
      subject,
      libraryOrdinal: 0,
      subjectOrdinal: subjectIndex + 1,
      sourceSlide: raw.sourceSlide,
      pageId:
        raw.pageId ??
        (() => {
          try {
            return new URL(raw.sourceImageUrl).searchParams.get("pageid") ?? "";
          } catch {
            return "";
          }
        })(),
      question: resolvedQuestionText,
      questionEn: normalizeText(ocrText?.question) || normalizeText(canonical?.questionEn),
      questionVi:
        (viTranslationMatchesSource && capitalizeFirstLetter(viTranslation.questionVi)) ||
        capitalizeFirstLetter(canonical?.questionVi) ||
        capitalizeFirstLetter(raw.questionVi),
      options: resolvedOptions,
      optionsVi: resolvedOptionsVi,
      optionLabels: resolvedOptions.map((_, index) => String.fromCharCode(65 + index)),
      answerLetters,
      answerIndexes,
      responseMode: answerLetters.length > 1 ? "multiple" : "single",
      answerLetter: answerLetters.join(""),
      answerIndex: answerIndexes.length === 1 ? answerIndexes[0] : answerIndexes,
      correctAnswer: resolvedCorrectAnswer,
      sourceAnswerText: sourceCorrectAnswer,
      correctAnswerEn:
        normalizeText(canonical?.correctAnswerEn) ||
        normalizeText(raw.correctAnswerEn) ||
        correctOptionTexts.join("; "),
      correctAnswerVi:
        answerIndexes
          .map((index) => resolvedOptionsVi[index])
          .filter(Boolean)
          .map((option, index) => `${answerLetters[index]}. ${option}`)
          .join("; ") ||
        normalizeText(canonical?.correctAnswerVi) ||
        normalizeText(raw.correctAnswerVi) ||
        resolvedCorrectAnswer,
      explanation: resolvedExplanation,
      explanationVi: resolvedExplanation,
      image: localImage,
      sourceImageUrl: raw.sourceImageUrl,
      source: {
        documentId: "1jSA13wRNJPU1fIQMf-gFIM-C9l4ZmWnPC6gdE9-3E8Y",
        slide: raw.sourceSlide,
        pageId:
          raw.pageId ??
          (() => {
            try {
              return new URL(raw.sourceImageUrl).searchParams.get("pageid") ?? "";
            } catch {
              return "";
            }
          })(),
        image: localImage,
        remoteImageUrl: raw.sourceImageUrl,
      },
      sourceOccurrenceCount: 1,
      translation: viTranslationMatchesSource
        ? {
            language: "vi",
            questionSource:
              viTranslation.translationReview?.questionSource ??
              viTranslation.questionTranslationSource,
            optionSource:
              viTranslation.translationReview?.optionSource ??
              viTranslation.optionTranslationSource,
            status: viTranslation.translationReview?.status ?? "reviewed",
          }
        : null,
      verification: {
        ...verification,
        evidence: unique([
          ...verification.evidence,
          ocrCorrection && !independentOcrCorrection && "manual-image-transcription",
          independentOcrCorrection && "independent-ocr-cross-review",
        ]),
      },
      qualityFlags: [],
    };
    question.topic = topicFor(question);
    question.qualityFlags = unique([
      !question.question && "missing-question",
      question.options.filter(Boolean).length < 2 && "missing-options",
      !question.questionVi && "missing-question-translation",
      question.optionsVi.length !== question.options.length && "missing-option-translations",
      question.answerLetters.length === 0 && "missing-answer",
      !question.explanation && "missing-explanation",
      !sourceCorrectAnswer && "correct-answer-derived-from-ocr-option",
      !sourceExplanation && "solution-derived-from-answer-code",
      semanticReview?.status === "semantic-conflict" && "semantic-answer-conflict",
      semanticReview?.status === "semantic-uncertain" && "semantic-answer-uncertain",
      applyReviewedAnswer && "answer-key-corrected-from-cross-review",
      independentOcrCorrection && "ocr-content-corrected-from-cross-review",
    ]);
    if (applyReviewedAnswer) {
      question.qualityFlags = question.qualityFlags.filter(
        (flag) => flag !== "semantic-answer-conflict" && flag !== "semantic-answer-uncertain",
      );
    }
    return question;
  }),
);

questions.forEach((question, index) => {
  question.libraryOrdinal = index + 1;
});

if (questions.length !== 483) {
  throw new Error(`Expected 483 real questions after excluding separator slides, received ${questions.length}.`);
}

const repeatedQuestions = questions.filter(
  (question, index) => index < 450 && question.verification.status === "verified" && question.responseMode === "single",
).slice(0, 17);

if (repeatedQuestions.length !== 17) {
  throw new Error("Could not select 17 deterministic verified questions for the final practice set.");
}

const accents = ["#ff8b5f", "#63d6c5", "#cab6ff", "#f6c85f", "#82b1ff"];
const exams = Array.from({ length: 10 }, (_, index) => {
  const normalQuestions = index < 9 ? questions.slice(index * 50, index * 50 + 50) : questions.slice(450);
  const assignedQuestions = index === 9 ? [...normalQuestions, ...repeatedQuestions] : normalQuestions;
  const assignments = assignedQuestions.map((question, assignmentIndex) => ({
    questionId: question.id,
    kind: index === 9 && assignmentIndex >= normalQuestions.length ? "practice-repeat" : "source",
    repeatedFromExamId:
      index === 9 && assignmentIndex >= normalQuestions.length
        ? `SSG-LIB-${String(Math.floor((question.libraryOrdinal - 1) / 50) + 1).padStart(2, "0")}`
        : null,
  }));
  return {
    schemaVersion: 2,
    id: `SSG-LIB-${String(index + 1).padStart(2, "0")}`,
    label: `Bộ ${String(index + 1).padStart(2, "0")} · 50 câu`,
    note:
      index === 9
        ? "33 câu nguồn cuối + 17 câu ôn lặp được đánh dấu rõ để đủ 50"
        : `50 câu nguồn liên tiếp, lượt ${index * 50 + 1}–${index * 50 + 50}`,
    accent: accents[index % accents.length],
    sourceQuestionCount: normalQuestions.length,
    repeatedQuestionCount: index === 9 ? 17 : 0,
    questionIds: assignedQuestions.map((question) => question.id),
    assignments,
  };
});

const assignmentCount = exams.flatMap((exam) => exam.questionIds).reduce((result, id) => {
  result[id] = (result[id] ?? 0) + 1;
  return result;
}, {});

const topicCounts = questions.reduce((result, question) => {
  result[question.topic] ??= { uniqueQuestionCount: 0, practiceAssignmentCount: 0 };
  result[question.topic].uniqueQuestionCount += 1;
  result[question.topic].practiceAssignmentCount += assignmentCount[question.id] ?? 0;
  return result;
}, {});

const verificationCounts = questions.reduce((result, question) => {
  result[question.verification.status] = (result[question.verification.status] ?? 0) + 1;
  return result;
}, {});
const appliedAnswerCorrections = (answerReviewV2?.records ?? []).filter(
  shouldApplyReviewedAnswer,
);

const stats = {
  schemaVersion: 2,
  sourceSlideCount: 507,
  nonQuestionSlideCount: 24,
  uniqueQuestionCount: 483,
  sourceQuestionOccurrenceCount: 483,
  practiceAssignmentCount: 500,
  repeatedPracticeAssignmentCount: 17,
  examCount: 10,
  questionsPerExam: 50,
  subjects: [
    {
      subject: "SSG104",
      uniqueQuestionCount: 353,
      firstSlide: 9,
      lastSlide: 376,
      excludedSeparatorSlides: [...SSG104_NON_QUESTION_SLIDES],
    },
    { subject: "SSG105", uniqueQuestionCount: 130, firstSlide: 378, lastSlide: 507 },
  ],
  verification: verificationCounts,
  semanticAnswerReview: {
    reviewedQuestionCount:
      answerReviewV2?.summary?.reviewedQuestionCount ?? ssg104AnswerReview.summary.reviewedCount,
    verdictCounts: answerReviewV2?.summary?.verdictCounts ?? null,
    agreedQuestionCount:
      answerReviewV2?.summary?.verdictCounts?.agreed ?? ssg104AnswerReview.summary.agreedCount,
    conflictQuestionCount:
      answerReviewV2?.summary?.verdictCounts?.["semantic-conflict"] ??
      ssg104AnswerReview.summary.conflictCount,
    uncertainQuestionCount:
      answerReviewV2?.summary?.verdictCounts?.["semantic-uncertain"] ??
      ssg104AnswerReview.summary.uncertainCount,
    conflictQuestionIds:
      answerReviewV2?.summary?.semanticConflictIds ??
      ssg104AnswerReview.conflicts.map((record) => record.id),
    uncertainQuestionIds:
      answerReviewV2?.summary?.semanticUncertainIds ??
      ssg104AnswerReview.uncertain.map((record) => record.id),
    appliedCorrectionIds: appliedAnswerCorrections.map((record) => record.id),
    answerPolicy:
      "High-confidence semantic conflicts and explicit multi-select mode mismatches are corrected; ambiguous source items remain flagged.",
  },
  ocrCoverage: {
    questionTextCount: questions.filter((question) => question.question).length,
    ocrQuestionTextCount: questions.filter((question) => question.questionEn).length,
    noteFallbackQuestionCount: questions.filter(
      (question) => question.question && !question.questionEn,
    ).length,
    optionsCount: questions.filter((question) => question.options.filter(Boolean).length >= 2).length,
    missingQuestionTextIds: questions.filter((question) => !question.question).map((question) => question.id),
    missingOptionsIds: questions.filter((question) => question.options.filter(Boolean).length < 2).map((question) => question.id),
  },
  topics: Object.entries(topicCounts)
    .map(([topic, counts]) => ({ topic, ...counts, advice: STUDY_ADVICE[topic] }))
    .toSorted(
      (left, right) =>
        right.uniqueQuestionCount - left.uniqueQuestionCount || left.topic.localeCompare(right.topic, "vi"),
    ),
  repeatedForPractice: repeatedQuestions.map((question) => ({
    id: question.id,
    subject: question.subject,
    sourceSlide: question.sourceSlide,
    topic: question.topic,
    sourceOccurrenceCount: 1,
    practiceAssignmentCount: assignmentCount[question.id],
    repeatedInExamId: "SSG-LIB-10",
    reason: "Bổ sung 17 lượt ôn để bộ cuối đủ 50; đây không phải câu nguồn mới.",
  })),
};

const sourceSummary = {
  schemaVersion: 2,
  title: "SSG104 + SSG105 question library",
  sourceFile: ssg104Source.sourceFile,
  sourceSha256: ssg104Source.sourceSha256,
  totalSlides: 507,
  nonQuestionSlides: [
    1, 2, 3, 4, 5, 6, 7, 8,
    ...SSG104_NON_QUESTION_SLIDES,
    377,
  ].toSorted((left, right) => left - right),
  questionCount: 483,
  firstQuestionSlide: 9,
  lastQuestionSlide: 507,
  markerSlide: 377,
  subjects: stats.subjects,
};

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(outputRoot, "questions.json"), `${JSON.stringify(questions, null, 2)}\n`, "utf8"),
  writeFile(path.join(outputRoot, "exams.json"), `${JSON.stringify(exams, null, 2)}\n`, "utf8"),
  writeFile(path.join(outputRoot, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8"),
  writeFile(path.join(outputRoot, "source-summary.json"), `${JSON.stringify(sourceSummary, null, 2)}\n`, "utf8"),
]);

console.log(
  `Built SSG library: ${questions.length} unique questions, ${exams.length}×50 assignments, ${stats.ocrCoverage.optionsCount} with OCR options.`,
);
