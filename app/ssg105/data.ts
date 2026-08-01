import examDefinitions from "../../data/ssg105/exams.json";
import questions from "../../data/ssg105/questions.json";
import source from "../../data/ssg105/source-notes.json";
import statistics from "../../data/ssg105/stats.json";

export type SsgQuestion = {
  id: string;
  ordinal: number;
  sourceSlide: number;
  pageId: string;
  questionVi: string;
  correctAnswer: string;
  correctAnswerEn: string;
  correctAnswerVi: string;
  explanationVi: string;
  answerLetter: string;
  answerIndex: number;
  optionCount: number;
  image: string;
  topic: string;
  sourceOccurrenceCount: number;
  verification: {
    status: "verified";
    confidence: number;
    evidence: string[];
    reviewedBy: string[];
  };
  qualityFlags: string[];
};

export type SsgExam = {
  id: "SSG105-01" | "SSG105-02" | "SSG105-03";
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

export const QUESTION_BANK = questions as SsgQuestion[];
const questionById = new Map(QUESTION_BANK.map((question) => [question.id, question]));

export const EXAMS: SsgExam[] = examDefinitions.map((definition) => ({
  ...definition,
  id: definition.id as SsgExam["id"],
  questions: definition.questionIds.map((id) => {
    const question = questionById.get(id);
    if (!question) throw new Error(`Missing SSG105 question ${id}`);
    return question;
  }),
}));

export const APPEARANCE_COUNT = EXAMS.flatMap((exam) => exam.questions).reduce<
  Record<string, number>
>((result, question) => {
  result[question.id] = (result[question.id] ?? 0) + 1;
  return result;
}, {});

const repeatedForPractice = statistics.repeatedForPractice as PracticeRepeat[];
export const FREQUENT_QUESTIONS = repeatedForPractice.map((item) => {
  const question = questionById.get(item.id);
  if (!question) throw new Error(`Missing repeated SSG105 question ${item.id}`);
  return question;
});

export const TOPIC_STATS = statistics.topics as TopicStatistic[];

export const SOURCE_SUMMARY = {
  sourceFile: source.sourceFile,
  sourceSha256: source.sourceSha256,
  totalSlides: source.totalSlides,
  markerSlide: source.markerSlide,
  firstQuestionSlide: source.firstQuestionSlide,
  lastQuestionSlide: source.lastQuestionSlide,
  questionCount: source.questionCount,
  verifiedQuestionCount: QUESTION_BANK.filter(
    (question) => question.verification.status === "verified",
  ).length,
  correctedFromImageCount: 9,
};
