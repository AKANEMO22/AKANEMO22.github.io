import examDefinitions from "../../data/ssg/exams.json";
import questions from "../../data/ssg/questions.json";
import source from "../../data/ssg/source-summary.json";
import statistics from "../../data/ssg/stats.json";

export type SsgQuestion = {
  id: string;
  ordinal: number;
  libraryOrdinal: number;
  subjectOrdinal: number;
  subject: string;
  sourceSlide: number;
  pageId: string;
  question: string;
  questionVi: string;
  options: string[];
  optionsVi: string[];
  correctAnswer: string;
  correctAnswerEn: string;
  correctAnswerVi: string;
  explanationVi: string;
  answerLetter: string;
  answerLetters: string[];
  answerIndex: number;
  answerIndexes: number[];
  responseMode: "single" | "multiple";
  optionCount: number;
  image: string;
  topic: string;
  sourceOccurrenceCount: number;
  verification: {
    status: string;
    confidence: number;
    evidence: string[];
    reviewedBy: string[];
  };
  qualityFlags: string[];
};

export type SsgExam = {
  id: string;
  label: string;
  note: string;
  accent: string;
  questions: SsgQuestion[];
};

type TopicStatistic = {
  topic: string;
  count: number;
  advice: string;
};

type PracticeRepeat = {
  id: string;
  sourceSlide: number;
  topic: string;
  sourceOccurrenceCount: number;
  practiceAssignmentCount: number;
};

type UnknownRecord = Record<string, unknown>;

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
}

function normalizeOptions(value: unknown, optionCount: number) {
  if (Array.isArray(value)) {
    const normalized = value.map((option) => asString(option));
    if (normalized.some(Boolean)) return normalized;
  }

  if (value && typeof value === "object") {
    const normalized = Object.entries(value as UnknownRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, option]) => asString(option));
    if (normalized.some(Boolean)) return normalized;
  }

  return LETTERS.slice(0, optionCount).map(
    (letter) => `Lựa chọn ${letter} — xem nguyên văn trong ảnh nguồn`,
  );
}

function normalizeIndexes(raw: UnknownRecord, optionCount: number) {
  const fromIndexes = Array.isArray(raw.answerIndexes)
    ? raw.answerIndexes.filter((index): index is number => Number.isInteger(index))
    : [];
  const fromLetters = asStringArray(raw.answerLetters)
    .map((letter) => LETTERS.indexOf(letter.toUpperCase()))
    .filter((index) => index >= 0);
  const legacyIndex = Number.isInteger(raw.answerIndex) ? [raw.answerIndex as number] : [];
  const legacyLetter = asString(raw.answerLetter)
    .split(/[,/;+&\s]+/)
    .map((letter) => LETTERS.indexOf(letter.toUpperCase()))
    .filter((index) => index >= 0);

  return [...new Set([...fromIndexes, ...fromLetters, ...legacyIndex, ...legacyLetter])]
    .filter((index) => index < optionCount)
    .toSorted((left, right) => left - right);
}

function normalizeQuestion(value: unknown, index: number): SsgQuestion {
  const raw = asRecord(value);
  const ocr = asRecord(raw.ocr);
  const verification = asRecord(raw.verification);
  const legacyOptionCount = Math.max(2, Math.min(LETTERS.length, asNumber(raw.optionCount, 4)));
  const options = normalizeOptions(raw.options ?? ocr.options, legacyOptionCount);
  const translatedOptions = asStringArray(raw.optionsVi);
  const optionsVi =
    translatedOptions.length === options.length && translatedOptions.every(Boolean)
      ? translatedOptions
      : options;
  const answerIndexes = normalizeIndexes(raw, options.length);
  const answerLetters = answerIndexes.map((answerIndex) => LETTERS[answerIndex]);
  const ordinal = asNumber(raw.ordinal, index + 1);
  const sourceSlide = asNumber(raw.sourceSlide, ordinal);
  const questionVi = asString(raw.questionVi);
  const questionText = asString(
    raw.question ?? raw.questionEn ?? raw.questionText ?? ocr.questionText,
    questionVi || `Câu hỏi ở slide ${sourceSlide}`,
  );

  return {
    id: asString(raw.id, `SSG-S${sourceSlide}`),
    ordinal,
    libraryOrdinal: asNumber(raw.libraryOrdinal, ordinal),
    subjectOrdinal: asNumber(raw.subjectOrdinal, ordinal),
    subject: asString(raw.subject, "SSG105"),
    sourceSlide,
    pageId: asString(raw.pageId),
    question: questionText,
    questionVi,
    options,
    optionsVi,
    correctAnswer: asString(raw.correctAnswer),
    correctAnswerEn: asString(raw.correctAnswerEn),
    correctAnswerVi: asString(raw.correctAnswerVi),
    explanationVi: asString(raw.explanationVi, "Đối chiếu đáp án với ảnh và ghi chú nguồn."),
    answerLetter: asString(raw.answerLetter, answerLetters.join(", ")),
    answerLetters,
    answerIndex: answerIndexes[0] ?? -1,
    answerIndexes,
    responseMode:
      raw.responseMode === "multiple" || answerIndexes.length > 1 ? "multiple" : "single",
    optionCount: options.length,
    image: asString(raw.image),
    topic: asString(raw.topic, "Kiến thức tổng hợp"),
    sourceOccurrenceCount: asNumber(raw.sourceOccurrenceCount, 1),
    verification: {
      status: asString(verification.status, "pending"),
      confidence: asNumber(verification.confidence),
      evidence: asStringArray(verification.evidence),
      reviewedBy: asStringArray(verification.reviewedBy),
    },
    qualityFlags: asStringArray(raw.qualityFlags),
  };
}

export const QUESTION_BANK = (questions as unknown[]).map(normalizeQuestion);
const questionById = new Map(QUESTION_BANK.map((question) => [question.id, question]));

export const EXAMS: SsgExam[] = (examDefinitions as unknown[]).map((value, index) => {
  const definition = asRecord(value);
  const questionIds = asStringArray(definition.questionIds);
  return {
    id: asString(definition.id, `SSG-LIB-${String(index + 1).padStart(2, "0")}`),
    label: asString(definition.label, `Bộ ${String(index + 1).padStart(2, "0")}`),
    note: asString(definition.note, `${questionIds.length} câu từ kho SSG`),
    accent: asString(definition.accent, "#ff8b5f"),
    questions: questionIds.map((id) => {
      const question = questionById.get(id);
      if (!question) throw new Error(`Missing SSG question ${id}`);
      return question;
    }),
  };
});

export const APPEARANCE_COUNT = EXAMS.flatMap((exam) => exam.questions).reduce<
  Record<string, number>
>((result, question) => {
  result[question.id] = (result[question.id] ?? 0) + 1;
  return result;
}, {});

const statisticsRecord = asRecord(statistics);
const repeatedForPractice = Array.isArray(statisticsRecord.repeatedForPractice)
  ? (statisticsRecord.repeatedForPractice as PracticeRepeat[])
  : [];
export const FREQUENT_QUESTIONS = repeatedForPractice.flatMap((item) => {
  const question = questionById.get(item.id);
  return question ? [question] : [];
});

export const TOPIC_STATS: TopicStatistic[] = Array.isArray(statisticsRecord.topics)
  ? statisticsRecord.topics.map((value) => {
      const item = asRecord(value);
      return {
        topic: asString(item.topic, "Kiến thức tổng hợp"),
        count: asNumber(item.count, asNumber(item.uniqueQuestionCount)),
        advice: asString(item.advice),
      };
    })
  : [];

const sourceRecord = asRecord(source);
const sourceSlides = QUESTION_BANK.map((question) => question.sourceSlide);

export const SOURCE_SUMMARY = {
  sourceFile: asString(sourceRecord.sourceFile),
  sourceSha256: asString(sourceRecord.sourceSha256),
  totalSlides: asNumber(sourceRecord.totalSlides, Math.max(...sourceSlides, 0)),
  markerSlide: asNumber(sourceRecord.markerSlide),
  firstQuestionSlide: asNumber(sourceRecord.firstQuestionSlide, Math.min(...sourceSlides)),
  lastQuestionSlide: asNumber(sourceRecord.lastQuestionSlide, Math.max(...sourceSlides)),
  questionCount: QUESTION_BANK.length,
  verifiedQuestionCount: QUESTION_BANK.filter(
    (question) => question.verification.status === "verified",
  ).length,
  practiceAssignmentCount: EXAMS.reduce((total, exam) => total + exam.questions.length, 0),
};
