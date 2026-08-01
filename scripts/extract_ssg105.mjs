import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultSource = path.resolve(
  projectRoot,
  "..",
  "..",
  "SEMESTER_4_SSG104 - Google Trang trình bày.html",
);
const sourcePath = path.resolve(process.argv[2] ?? defaultSource);
const outputPath = path.resolve(
  process.argv[3] ?? path.join(projectRoot, "data", "ssg105", "source-notes.json"),
);

function decodeHtml(text) {
  return text
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'");
}

function cleanText(fragment) {
  return decodeHtml(
    fragment
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\uFFFD/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function paragraphText(fragment) {
  return [...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .flatMap((value) => value.split("\n"))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSlideChunks(html) {
  return [
    ...html.matchAll(
      /<div role="group" class="slide"[\s\S]*?(?=<div role="group" class="slide"|<\/body>)/gi,
    ),
  ].map((match) => match[0]);
}

function getVisibleText(slide) {
  const section = slide.match(/<section class="slide-content"[\s\S]*?<\/section>/i)?.[0];
  return section ? cleanText(section) : "";
}

function getNotes(slide) {
  const aside = slide.match(/<aside\b[\s\S]*?<\/aside>/i)?.[0];
  return aside ? paragraphText(aside) : [];
}

function getImageUrl(slide) {
  const rawUrl = slide.match(/background-image:\s*url\((https:[^)]+)\)/i)?.[1];
  return rawUrl ? decodeHtml(rawUrl).replace(/;$/, "") : "";
}

function splitAnswer(value) {
  const normalized = value.replace(/^\s*[A-F][.)]?\s*/i, "").trim();
  const bilingual = normalized.match(/^(.+?)\s+[–—-]\s+(.+)$/);
  if (!bilingual) {
    return { text: normalized, english: "", vietnamese: normalized };
  }

  const [first, second] = [bilingual[1].trim(), bilingual[2].trim()];
  const firstLooksEnglish = /\b(the|to|and|of|in|for|with|all|report|team|email|message)\b/i.test(
    first,
  );
  return firstLooksEnglish
    ? { text: normalized, english: first, vietnamese: second }
    : { text: normalized, english: second, vietnamese: first };
}

function parseQuestion(slide, slideNumber) {
  const notes = getNotes(slide);
  const joined = notes.join("\n");
  const answerMatch = joined.match(/^\s*([A-F])(?:\b|\s|[.)])/i);
  const answerLetter = answerMatch?.[1]?.toUpperCase() ?? "";
  const answerIndex = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;
  const cleaned = [...notes];

  if (cleaned.length && answerLetter) {
    cleaned[0] = cleaned[0].replace(/^\s*[A-F](?:\b|\s|[.)])\s*/i, "").trim();
    if (!cleaned[0]) cleaned.shift();
  }

  const arrowIndex = cleaned.findIndex((line) => /^\s*(?:→|->)/.test(line));
  let question = "";
  let correctAnswer = "";
  let explanation = "";

  if (arrowIndex >= 0) {
    question = cleaned.slice(0, arrowIndex).join(" ").trim();
    correctAnswer = cleaned[arrowIndex].replace(/^\s*(?:→|->)\s*/, "").trim();
    explanation = cleaned.slice(arrowIndex + 1).join(" ").trim();
  } else {
    question = cleaned[0] ?? "";
    correctAnswer = cleaned[1] ?? "";
    explanation = cleaned.slice(2).join(" ").trim();
  }

  const answer = splitAnswer(correctAnswer);
  return {
    id: `SSG105-S${String(slideNumber).padStart(3, "0")}`,
    sourceSlide: slideNumber,
    answerLetter,
    answerIndex,
    questionVi: question,
    correctAnswer: answer.text,
    correctAnswerEn: answer.english,
    correctAnswerVi: answer.vietnamese,
    explanationVi: explanation,
    notes,
    sourceImageUrl: getImageUrl(slide),
    verifiedFromNotes: Boolean(answerLetter && question && correctAnswer),
  };
}

const html = await readFile(sourcePath, "utf8");
const slides = getSlideChunks(html);
const markerIndex = slides.findIndex((slide) =>
  /HỌC THÊM[\s\S]*SSG105/i.test(getVisibleText(slide)),
);

if (markerIndex < 0) {
  throw new Error("Không tìm thấy slide mốc HỌC THÊM / SSG105.");
}

const questions = slides
  .slice(markerIndex + 1)
  .map((slide, index) => parseQuestion(slide, markerIndex + index + 2));
const complete = questions.filter((question) => question.verifiedFromNotes);
const incomplete = questions.filter((question) => !question.verifiedFromNotes);
const sourceSha256 = createHash("sha256").update(html).digest("hex");

const output = {
  subject: "SSG105",
  sourceFile: path.basename(sourcePath),
  sourceSha256,
  markerSlide: markerIndex + 1,
  firstQuestionSlide: markerIndex + 2,
  lastQuestionSlide: slides.length,
  totalSlides: slides.length,
  questionCount: questions.length,
  verifiedFromNotesCount: complete.length,
  incompleteCount: incomplete.length,
  questions,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Đã đọc ${slides.length} slide từ ${sourcePath}`);
console.log(`SSG105: slide ${markerIndex + 2}-${slides.length}, ${questions.length} câu`);
console.log(`Ghi chú đủ cấu trúc: ${complete.length}/${questions.length}`);
if (incomplete.length) {
  console.log(
    `Cần đối chiếu thêm slide: ${incomplete.map((item) => item.sourceSlide).join(", ")}`,
  );
}
console.log(outputPath);
