import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataRoot = path.join(projectRoot, "data", "ssg105");
const source = JSON.parse(await readFile(path.join(dataRoot, "source-notes.json"), "utf8"));
const corrections = JSON.parse(await readFile(path.join(dataRoot, "corrections.json"), "utf8"));
const ocrAudit = JSON.parse(
  await readFile(path.join(dataRoot, "audit", "ocr-asset-audit.json"), "utf8"),
);
const answerReview = JSON.parse(
  await readFile(path.join(dataRoot, "audit", "answer-review.json"), "utf8"),
);

const TOPIC_RULES = [
  [/report|báo cáo|planning checklist|dàn ý|outline|nghiên cứu|research|đạo văn|plagiarism/i, "Viết & nghiên cứu"],
  [/meeting|cuộc họp|biên bản|agenda|action item|team meeting planner/i, "Tổ chức cuộc họp"],
  [/email|memo|business letter|business proposal|thư thương mại|dòng tiêu đề|subject line|text message|nhắn tin/i, "Giao tiếp kinh doanh"],
  [/résumé|resume|phỏng vấn|interview|nghề nghiệp|career|thực tập|transferable skill/i, "Nghề nghiệp & tuyển dụng"],
  [/thuyết trình|presentation|persuasive|pathos|ethos|logos|maslow|monroe|audience|khán giả/i, "Thuyết trình thuyết phục"],
  [/phi ngôn ngữ|nonverbal|paralanguage|giọng|eye contact|ánh mắt|cử chỉ|gesture/i, "Giao tiếp phi ngôn ngữ"],
  [/xung đột|conflict|feedback|phản hồi|face-saving|dewey|problem|vấn đề/i, "Giải quyết vấn đề & xung đột"],
  [/lãnh đạo|leader|manager|quản lý|influence|ảnh hưởng|integrity|chính trực|coach/i, "Lãnh đạo & quản lý"],
  [/team|group|nhóm|psychological safety|trust|tin tưởng|cohesiveness|gắn kết/i, "Làm việc nhóm"],
];

const STUDY_ADVICE = {
  "Viết & nghiên cứu": "Ôn cấu trúc báo cáo, planning checklist, nguồn nội bộ/bên ngoài và quy tắc tránh đạo văn.",
  "Tổ chức cuộc họp": "Nắm agenda, ground rules, vai trò điều phối, biên bản và action items có người phụ trách/thời hạn.",
  "Giao tiếp kinh doanh": "Phân biệt email, memo, thư thương mại và proposal; ưu tiên mục đích, đối tượng và văn phong phù hợp.",
  "Nghề nghiệp & tuyển dụng": "Ôn résumé, STAR, kỹ năng chuyển giao, chuẩn bị phỏng vấn và phát triển nghề nghiệp liên tục.",
  "Thuyết trình thuyết phục": "Học Ethos–Pathos–Logos, phân tích khán giả, Monroe và nhu cầu Maslow.",
  "Giao tiếp phi ngôn ngữ": "Nhớ vai trò của ánh mắt, cử chỉ, tư thế, cao độ và tốc độ nói.",
  "Giải quyết vấn đề & xung đột": "Ôn quy trình Dewey, phản hồi hướng mục tiêu, face-saving và phản ứng xây dựng.",
  "Lãnh đạo & quản lý": "Tập trung vào ảnh hưởng, chính trực, coaching, tự chủ đi kèm trách nhiệm giải trình.",
  "Làm việc nhóm": "Ưu tiên trust equation, psychological safety, mục tiêu chung, tính gắn kết và trách nhiệm chung.",
  "Kiến thức tổng hợp": "Ôn theo ảnh gốc và dùng lời giải để nối khái niệm với tình huống.",
};

function topicFor(question) {
  const text = `${question.questionVi} ${question.correctAnswer} ${question.explanationVi}`;
  return TOPIC_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "Kiến thức tổng hợp";
}

function optionCountFor(question) {
  const record = ocrAudit.records.find((item) => item.sourceSlide === question.sourceSlide);
  const hasOptionE = record?.ocr?.detectedOptionLabels?.includes("E") ?? false;
  return question.answerLetter === "E" || hasOptionE ? 5 : 4;
}

const correctionBySlide = new Map(
  corrections.corrections.map((item) => [item.sourceSlide, item]),
);

if (answerReview.summary.reviewedCount !== 130) {
  throw new Error("Independent answer review must cover all 130 SSG105 questions.");
}

if (answerReview.summary.answerLetterConflicts !== 0) {
  throw new Error("Independent answer review still contains answer-letter conflicts.");
}

const questions = source.questions.map((raw, index) => {
  const correction = correctionBySlide.get(raw.sourceSlide) ?? {};
  const reviewedAnswer = answerReview.proposedAnswerBySourceSlide[String(raw.sourceSlide)];
  if (reviewedAnswer !== raw.answerLetter) {
    throw new Error(
      `Slide ${raw.sourceSlide}: speaker-note answer ${raw.answerLetter} conflicts with independent review ${reviewedAnswer}.`,
    );
  }
  const reviewConfidence =
    answerReview.confidencePolicy.overrides[String(raw.sourceSlide)] ??
    answerReview.confidencePolicy.default;
  const merged = {
    id: raw.id,
    ordinal: index + 1,
    sourceSlide: raw.sourceSlide,
    pageId: new URL(raw.sourceImageUrl).searchParams.get("pageid"),
    questionVi: correction.questionVi ?? raw.questionVi,
    correctAnswer: correction.correctAnswer ?? raw.correctAnswer,
    correctAnswerEn: correction.correctAnswerEn ?? raw.correctAnswerEn,
    correctAnswerVi: correction.correctAnswerVi ?? raw.correctAnswerVi,
    explanationVi: correction.explanationVi ?? raw.explanationVi,
    answerLetter: raw.answerLetter,
    answerIndex: raw.answerIndex,
    image: `/ssg105/source/slide-${String(raw.sourceSlide).padStart(4, "0")}.png`,
    sourceOccurrenceCount: 1,
    verification: {
      status: "verified",
      confidence: Math.min(correction.confidence ?? 1, reviewConfidence),
      evidence: [
        ...new Set([
          ...(correction.evidence ?? ["speaker-note-answer-code", "independent-extraction-audit"]),
          "independent-answer-review",
          "ocr-asset-audit",
        ]),
      ],
      reviewedBy: [
        ...new Set([
          ...(correction.reviewedBy ?? ["speaker-notes-audit"]),
          "answer-review-agent",
          "ocr-asset-audit-agent",
        ]),
      ],
    },
  };
  merged.optionCount = optionCountFor(merged);
  merged.topic = topicFor(merged);
  merged.qualityFlags = [];
  return merged;
});

const topicFrequency = questions.reduce((result, question) => {
  result[question.topic] = (result[question.topic] ?? 0) + 1;
  return result;
}, {});

const reviewQuestions = questions
  .slice(0, 100)
  .toSorted((left, right) => {
    const frequencyDifference = topicFrequency[right.topic] - topicFrequency[left.topic];
    return frequencyDifference || left.sourceSlide - right.sourceSlide;
  })
  .slice(0, 20);

const exams = [
  {
    id: "SSG105-01",
    label: "Bộ 01 · Nền tảng",
    note: "50 câu đầu của phần SSG105",
    accent: "#ff8b5f",
    questionIds: questions.slice(0, 50).map((question) => question.id),
  },
  {
    id: "SSG105-02",
    label: "Bộ 02 · Vận dụng",
    note: "50 câu tiếp theo của phần SSG105",
    accent: "#63d6c5",
    questionIds: questions.slice(50, 100).map((question) => question.id),
  },
  {
    id: "SSG105-03",
    label: "Bộ 03 · Tổng ôn",
    note: "30 câu cuối + 20 câu trọng tâm được xếp lặp để đủ 50",
    accent: "#cab6ff",
    questionIds: [...questions.slice(100), ...reviewQuestions].map((question) => question.id),
  },
];

const assignmentCount = exams.flatMap((exam) => exam.questionIds).reduce((result, id) => {
  result[id] = (result[id] ?? 0) + 1;
  return result;
}, {});

const stats = {
  schemaVersion: 1,
  uniqueQuestionCount: questions.length,
  sourceOccurrenceCount: 1,
  practiceAssignmentCount: exams.reduce((sum, exam) => sum + exam.questionIds.length, 0),
  topics: Object.entries(topicFrequency)
    .map(([topic, count]) => ({ topic, count, advice: STUDY_ADVICE[topic] }))
    .toSorted((left, right) => right.count - left.count || left.topic.localeCompare(right.topic, "vi")),
  repeatedForPractice: questions
    .filter((question) => assignmentCount[question.id] > 1)
    .map((question) => ({
      id: question.id,
      sourceSlide: question.sourceSlide,
      topic: question.topic,
      sourceOccurrenceCount: question.sourceOccurrenceCount,
      practiceAssignmentCount: assignmentCount[question.id],
    })),
};

await mkdir(dataRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(dataRoot, "questions.json"), `${JSON.stringify(questions, null, 2)}\n`, "utf8"),
  writeFile(path.join(dataRoot, "exams.json"), `${JSON.stringify(exams, null, 2)}\n`, "utf8"),
  writeFile(path.join(dataRoot, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8"),
]);

console.log(`Built ${questions.length} verified SSG105 questions, ${exams.length} exams, and topic stats.`);
