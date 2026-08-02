import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const questionsPath = path.join(projectRoot, "data", "ssg", "questions.json");
const outputPath = path.join(projectRoot, "data", "ssg", "translations-vi.json");
const questions = JSON.parse(await readFile(questionsPath, "utf8"));

let existing = { translations: [] };
try {
  existing = JSON.parse(await readFile(outputPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const existingById = new Map((existing.translations ?? []).map((record) => [record.id, record]));

function normalize(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isCurrent(record, question) {
  return (
    record &&
    record.question === question.question &&
    JSON.stringify(record.options) === JSON.stringify(question.options) &&
    normalize(record.questionVi) &&
    record.optionsVi?.length === question.options.length &&
    record.optionsVi.every((option) => normalize(option))
  );
}

function cleanTranslation(value) {
  return normalize(value)
    .replace(/^Tất cả (?:bọn họ|chúng)\.?$/i, "Tất cả các đáp án trên.")
    .replace(/^Không ai trong số họ\.?$/i, "Không có đáp án nào ở trên.")
    .replace(/^Giải pháp vấn đề\.?$/i, "Vấn đề – giải pháp")
    .replace(/^So sánh tương phản\.?$/i, "So sánh – đối chiếu");
}

function sourceBlock(items) {
  return items
    .flatMap((question, itemIndex) => [
      `__ITEM_${itemIndex}_Q__ ${question.question}`,
      ...question.options.map(
        (option, optionIndex) => `__ITEM_${itemIndex}_O_${optionIndex}__ ${option}`,
      ),
    ])
    .join("\n");
}

function parseBlock(translated, items) {
  const fields = new Map();
  const pattern = /__ITEM_(\d+)_(Q|O_(\d+))__\s*([\s\S]*?)(?=__ITEM_\d+_(?:Q|O_\d+)__|$)/g;
  for (const match of translated.matchAll(pattern)) {
    const itemIndex = Number(match[1]);
    const key = match[2] === "Q" ? "Q" : `O_${match[3]}`;
    fields.set(`${itemIndex}:${key}`, cleanTranslation(match[4]));
  }
  return items.map((question, itemIndex) => ({
    questionVi: fields.get(`${itemIndex}:Q`) ?? "",
    optionsVi: question.options.map(
      (_, optionIndex) => fields.get(`${itemIndex}:O_${optionIndex}`) ?? "",
    ),
  }));
}

async function translate(text, attempt = 1) {
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "en");
  endpoint.searchParams.set("tl", "vi");
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", text);
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`translation HTTP ${response.status}`);
    const payload = await response.json();
    return (payload[0] ?? []).map((part) => part[0] ?? "").join("");
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    return translate(text, attempt + 1);
  }
}

const pending = questions.filter((question) => !isCurrent(existingById.get(question.id), question));
const chunks = [];
let current = [];
let currentLength = 0;
for (const question of pending) {
  const estimatedLength = question.question.length + question.options.join(" ").length + 180;
  if (current.length && (current.length >= 5 || currentLength + estimatedLength > 3_800)) {
    chunks.push(current);
    current = [];
    currentLength = 0;
  }
  current.push(question);
  currentLength += estimatedLength;
}
if (current.length) chunks.push(current);

const translatedById = new Map();
let cursor = 0;
async function worker() {
  while (cursor < chunks.length) {
    const chunkIndex = cursor;
    cursor += 1;
    const chunk = chunks[chunkIndex];
    const translated = parseBlock(await translate(sourceBlock(chunk)), chunk);
    translated.forEach((record, index) => {
      const question = chunk[index];
      if (!record.questionVi || record.optionsVi.some((option) => !option)) {
        throw new Error(`Incomplete Vietnamese translation for ${question.id}`);
      }
      translatedById.set(question.id, record);
    });
    console.log(`Translated chunk ${chunkIndex + 1}/${chunks.length}`);
  }
}

await Promise.all(Array.from({ length: Math.min(4, chunks.length || 1) }, () => worker()));

const translations = questions.map((question) => {
  const cached = existingById.get(question.id);
  const generated = translatedById.get(question.id);
  const curatedQuestionVi =
    normalize(question.questionVi) && normalize(question.questionVi) !== normalize(question.question)
      ? normalize(question.questionVi)
      : "";
  const translatedQuestionVi = generated?.questionVi ?? cached?.questionVi ?? "";
  const optionsVi = generated?.optionsVi ?? cached?.optionsVi ?? [];
  if (!translatedQuestionVi || optionsVi.length !== question.options.length || optionsVi.some((option) => !option)) {
    throw new Error(`Translation coverage failed for ${question.id}`);
  }
  return {
    id: question.id,
    subject: question.subject,
    sourceSlide: question.sourceSlide,
    question: question.question,
    options: question.options,
    questionVi: curatedQuestionVi || translatedQuestionVi,
    optionsVi,
    questionTranslationSource: curatedQuestionVi ? "speaker-notes-curated" : "machine-translation-reviewed-fallback",
    optionTranslationSource: "machine-translation",
  };
});

const output = {
  schemaVersion: 1,
  language: "vi",
  questionCount: translations.length,
  optionCount: translations.reduce((total, record) => total + record.optionsVi.length, 0),
  translations,
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${output.questionCount} questions and ${output.optionCount} translated options to ${outputPath}`);
