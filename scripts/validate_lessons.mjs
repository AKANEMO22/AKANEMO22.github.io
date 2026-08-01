import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const examIds = ["SP26-FE", "FA25-FE", "SU25-FE", "FA24-RE"];
const allowedVisualTypes = new Set([
  "flow",
  "comparison",
  "formula",
  "matrix",
  "pipeline",
]);
const errors = [];

function readJson(...segments) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, ...segments), "utf8"),
  );
}

function requireText(value, minimum, label) {
  if (typeof value !== "string" || value.trim().length < minimum) {
    errors.push(`${label}: cần ít nhất ${minimum} ký tự`);
  }
  if (typeof value === "string" && value.includes("\uFFFD")) {
    errors.push(`${label}: chứa ký tự Unicode lỗi`);
  }
}

function requireTextRange(value, minimum, maximum, label) {
  requireText(value, minimum, label);
  if (typeof value === "string" && value.trim().length > maximum) {
    errors.push(`${label}: vượt quá ${maximum} ký tự`);
  }
}

for (const examId of examIds) {
  const questions = readJson("data", "exams", `${examId}.json`);
  const lessons = readJson("data", "lessons", `${examId}.json`);

  if (questions.length !== 50) {
    errors.push(`${examId}: dữ liệu đề không đủ 50 câu`);
  }
  if (lessons.length !== 50) {
    errors.push(`${examId}: bài học không đủ 50 câu`);
    continue;
  }

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  if (lessonById.size !== 50) {
    errors.push(`${examId}: id bài học bị trùng`);
  }

  for (const question of questions) {
    const lesson = lessonById.get(question.id);
    const label = `${examId} Q${question.number}`;
    if (!lesson) {
      errors.push(`${label}: thiếu bài học`);
      continue;
    }

    requireTextRange(
      lesson.visualLearning?.takeaway,
      35,
      120,
      `${label} visualLearning.takeaway`,
    );
    requireTextRange(
      lesson.visualLearning?.rule,
      10,
      100,
      `${label} visualLearning.rule`,
    );
    requireTextRange(
      lesson.visualLearning?.memoryHook,
      25,
      110,
      `${label} visualLearning.memoryHook`,
    );
    if (
      !Array.isArray(lesson.visualLearning?.flow) ||
      lesson.visualLearning.flow.length < 3 ||
      lesson.visualLearning.flow.length > 5
    ) {
      errors.push(`${label}: visualLearning.flow phải có 3–5 node`);
    } else {
      const allowedKinds = new Set(["input", "process", "result", "warning"]);
      lesson.visualLearning.flow.forEach((node, index) => {
        requireTextRange(
          node.label,
          3,
          28,
          `${label} visualLearning.flow.${index}.label`,
        );
        requireTextRange(
          node.note,
          15,
          85,
          `${label} visualLearning.flow.${index}.note`,
        );
        if (!allowedKinds.has(node.kind)) {
          errors.push(`${label}: visualLearning.flow.${index}.kind không hợp lệ`);
        }
      });
      if (!lesson.visualLearning.flow.some((node) => node.kind === "result")) {
        errors.push(`${label}: visualLearning.flow thiếu node result`);
      }
    }
    if (
      !Array.isArray(lesson.visualLearning?.optionCues) ||
      lesson.visualLearning.optionCues.length !== question.options.length
    ) {
      errors.push(`${label}: visualLearning.optionCues không khớp lựa chọn`);
    } else {
      lesson.visualLearning.optionCues.forEach((cue, index) =>
        requireTextRange(
          cue,
          15,
          85,
          `${label} visualLearning.optionCues.${index}`,
        ),
      );
    }

    requireText(
      lesson.translation?.question,
      8,
      `${label} translation.question`,
    );
    if (
      lesson.translation?.question?.trim().toLowerCase() ===
      question.question.trim().toLowerCase()
    ) {
      errors.push(`${label}: bản dịch câu hỏi vẫn giống nguyên văn tiếng Anh`);
    }
    if (
      typeof lesson.translation?.question === "string" &&
      !/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
        lesson.translation.question,
      )
    ) {
      errors.push(`${label}: bản dịch câu hỏi chưa thể hiện tiếng Việt có dấu`);
    }
    if (
      !Array.isArray(lesson.translation?.options) ||
      lesson.translation.options.length !== question.options.length
    ) {
      errors.push(`${label}: số lựa chọn bản dịch không khớp`);
    } else {
      lesson.translation.options.forEach((option, index) =>
        requireText(option, 1, `${label} translation.options.${index}`),
      );
    }

    requireText(lesson.concept?.title, 4, `${label} concept.title`);
    requireText(lesson.concept?.summary, 180, `${label} concept.summary`);
    requireText(lesson.whyCorrect, 200, `${label} whyCorrect`);
    requireText(lesson.example?.title, 4, `${label} example.title`);
    requireText(lesson.example?.scenario, 150, `${label} example.scenario`);
    requireText(lesson.example?.takeaway, 80, `${label} example.takeaway`);

    if (
      !Array.isArray(lesson.optionAnalysis) ||
      lesson.optionAnalysis.length !== question.options.length
    ) {
      errors.push(`${label}: số phân tích phương án không khớp`);
    } else {
      lesson.optionAnalysis.forEach((analysis, index) => {
        const expectedLetter = String.fromCharCode(65 + index);
        if (analysis.letter !== expectedLetter) {
          errors.push(`${label}: phương án ${index + 1} phải mang chữ ${expectedLetter}`);
        }
        const expectedVerdict =
          index === question.answer ? "correct" : "incorrect";
        if (analysis.verdict !== expectedVerdict) {
          errors.push(`${label}: verdict ${expectedLetter} không khớp answer`);
        }
        requireText(
          analysis.explanation,
          100,
          `${label} optionAnalysis.${expectedLetter}`,
        );
      });
    }

    if (!allowedVisualTypes.has(lesson.visual?.type)) {
      errors.push(`${label}: kiểu minh họa không hợp lệ`);
    }
    requireText(lesson.visual?.title, 1, `${label} visual.title`);
    requireText(lesson.visual?.caption, 70, `${label} visual.caption`);
    if (
      !Array.isArray(lesson.visual?.items) ||
      lesson.visual.items.length < 2 ||
      lesson.visual.items.length > 5
    ) {
      errors.push(`${label}: minh họa phải có 2–5 phần tử`);
    } else {
      lesson.visual.items.forEach((item, index) =>
        requireText(item, 1, `${label} visual.items.${index}`),
      );
    }

    requireText(
      lesson.deepDive?.mechanism,
      180,
      `${label} deepDive.mechanism`,
    );
    if (
      !Array.isArray(lesson.deepDive?.reasoningSteps) ||
      lesson.deepDive.reasoningSteps.length < 3 ||
      lesson.deepDive.reasoningSteps.length > 5
    ) {
      errors.push(`${label}: reasoningSteps phải có 3–5 bước`);
    } else {
      lesson.deepDive.reasoningSteps.forEach((step, index) =>
        requireText(step, 55, `${label} deepDive.reasoningSteps.${index}`),
      );
    }
    requireText(
      lesson.deepDive?.commonMistake,
      100,
      `${label} deepDive.commonMistake`,
    );
    requireText(
      lesson.deepDive?.examTip,
      80,
      `${label} deepDive.examTip`,
    );
  }

  if (new Set(lessons.map((lesson) => lesson.whyCorrect)).size !== 50) {
    errors.push(`${examId}: whyCorrect có nội dung lặp nguyên văn`);
  }
  if (new Set(lessons.map((lesson) => lesson.example?.scenario)).size !== 50) {
    errors.push(`${examId}: ví dụ có nội dung lặp nguyên văn`);
  }
  if (
    new Set(lessons.map((lesson) => lesson.translation?.question)).size !== 50
  ) {
    errors.push(`${examId}: bản dịch câu hỏi có nội dung lặp nguyên văn`);
  }
  if (
    new Set(lessons.map((lesson) => lesson.deepDive?.mechanism)).size !== 50
  ) {
    errors.push(`${examId}: deepDive.mechanism có nội dung lặp nguyên văn`);
  }
  if (
    new Set(lessons.map((lesson) => lesson.deepDive?.commonMistake)).size !== 50
  ) {
    errors.push(`${examId}: deepDive.commonMistake có nội dung lặp nguyên văn`);
  }
  if (
    new Set(lessons.map((lesson) => lesson.visualLearning?.takeaway)).size !== 50
  ) {
    errors.push(`${examId}: visualLearning.takeaway có nội dung lặp nguyên văn`);
  }
  if (
    new Set(lessons.map((lesson) => lesson.visualLearning?.memoryHook)).size !==
    50
  ) {
    errors.push(`${examId}: visualLearning.memoryHook có nội dung lặp nguyên văn`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("LESSON_VALIDATION_OK=200");
