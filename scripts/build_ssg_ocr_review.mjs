import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const questionsPath = path.join(projectRoot, "data", "ssg", "questions.json");
const tesseractPath = path.join(projectRoot, "data", "ssg", "ocr-tesseract-raw.json");
const outputPath = path.join(projectRoot, "data", "ssg", "audit", "ocr-ensemble-review.json");

const questions = JSON.parse(await readFile(questionsPath, "utf8"));
const tesseract = JSON.parse(await readFile(tesseractPath, "utf8"));
const tessById = new Map(tesseract.map((record) => [record.id, record]));

function cleanOcrText(value) {
  return String(value || "")
    .replace(/[\u00a0\u200b-\u200d\ufeff]/g, " ")
    .replace(/\bHo[aä]ng\s+Ho[aä]ng\b/gi, " ")
    .replace(/\b(?:F\s*)?O\s*R\s*U\b/gi, " ")
    .replace(/goals™\?/gi, "goals”?")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function canonical(value) {
  return cleanOcrText(value)
    .normalize("NFKD")
    .replace(/[“”‘’'"`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function similarity(left, right) {
  const a = canonical(left);
  const b = canonical(right);
  const length = Math.max(a.length, b.length);
  return length ? 1 - levenshtein(a, b) / length : 1;
}

function optionMarker(text, expectedLetter = "") {
  const match = String(text || "").match(/^\s*([A-F])(?:\s*[.)_:\-–—]\s*|\s+)(.*)$/);
  if (match) return { letter: match[1], text: match[2] };
  if (expectedLetter === "E") {
    const fallback = String(text || "").match(/^\s*[£€](?:\s*[.)_:\-–—]\s*|\s+)(.*)$/);
    if (fallback) return { letter: "E", text: fallback[1] };
  }
  return null;
}

function parseTesseract(record, expectedOptionCount) {
  const lines = (record?.lines || [])
    .map((line) => ({ ...line, text: cleanOcrText(line.text) }))
    .filter((line) => line.text && !/^(?:learn to know|estimating resolution)/i.test(line.text));
  const markers = [];
  let expectedIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const expectedLetter = String.fromCharCode(65 + expectedIndex);
    const marker = optionMarker(lines[index].text, expectedLetter);
    if (!marker || marker.letter !== expectedLetter) continue;
    markers.push({ index, letter: marker.letter, text: marker.text });
    expectedIndex += 1;
    if (expectedIndex === expectedOptionCount) break;
  }
  if (!markers.length || markers[0].letter !== "A") {
    return { question: cleanOcrText(record?.text), options: [], markerCount: markers.length };
  }

  const question = cleanOcrText(
    lines
      .slice(0, markers[0].index)
      .map((line) => line.text)
      .join(" "),
  );
  const options = markers.map((marker, markerIndex) => {
    const end = markers[markerIndex + 1]?.index ?? lines.length;
    return cleanOcrText(
      [marker.text, ...lines.slice(marker.index + 1, end).map((line) => line.text)].join(" "),
    );
  });
  return { question, options, markerCount: markers.length };
}

const reviews = questions.map((question) => {
  const raw = tessById.get(question.id);
  const parsed = parseTesseract(raw, question.options.length);
  const questionSimilarity = similarity(question.question, parsed.question);
  const optionSimilarities = question.options.map((option, index) =>
    similarity(option, parsed.options[index] || ""),
  );
  const exactQuestion = canonical(question.question) === canonical(parsed.question);
  const exactOptions = question.options.map(
    (option, index) => canonical(option) === canonical(parsed.options[index] || ""),
  );
  const needsReview =
    !exactQuestion ||
    exactOptions.some((exact) => !exact) ||
    parsed.options.length !== question.options.length;
  return {
    id: question.id,
    subject: question.subject,
    sourceSlide: question.sourceSlide,
    image: question.image,
    needsReview,
    current: {
      question: question.question,
      options: question.options,
    },
    tesseract: {
      question: parsed.question,
      options: parsed.options,
      confidence: raw?.confidence ?? 0,
      markerCount: parsed.markerCount,
    },
    comparison: {
      questionSimilarity: Math.round(questionSimilarity * 10000) / 10000,
      optionSimilarities: optionSimilarities.map((value) => Math.round(value * 10000) / 10000),
      exactQuestion,
      exactOptions,
    },
  };
});

const differing = reviews.filter((review) => review.needsReview);
const output = {
  schemaVersion: 1,
  source: "independent Tesseract OCR compared with current Windows/RapidOCR-derived library",
  totalQuestions: reviews.length,
  matchingQuestions: reviews.length - differing.length,
  reviewCount: differing.length,
  records: reviews,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `OCR ensemble review: ${reviews.length - differing.length} exact, ${differing.length} require review`,
);
console.log(outputPath);
