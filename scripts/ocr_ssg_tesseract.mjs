import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = path.resolve(import.meta.dirname, "..");
const questionsPath = path.join(projectRoot, "data", "ssg", "questions.json");
const outputPath = path.join(projectRoot, "data", "ssg", "ocr-tesseract-raw.json");
const tesseractRoot =
  process.env.SSG_TESSERACT_ROOT ||
  "C:/Users/hachimi/AppData/Local/Temp/ssg-tesseract/node_modules/tesseract.js";

const require = createRequire(import.meta.url);
const { createScheduler, createWorker, PSM } = require(tesseractRoot);
const workerCount = Math.max(
  1,
  Math.min(6, Number.parseInt(process.env.SSG_OCR_WORKERS || "4", 10) || 4),
);

function parseTsv(tsv) {
  const words = [];
  for (const row of String(tsv || "").split(/\r?\n/)) {
    if (!row.trim()) continue;
    const fields = row.split("\t");
    if (fields.length < 12 || fields[0] !== "5") continue;
    const text = fields.slice(11).join("\t").trim();
    if (!text) continue;
    words.push({
      block: Number(fields[2]),
      paragraph: Number(fields[3]),
      line: Number(fields[4]),
      word: Number(fields[5]),
      x: Number(fields[6]),
      y: Number(fields[7]),
      width: Number(fields[8]),
      height: Number(fields[9]),
      confidence: Number(fields[10]),
      text,
    });
  }

  const grouped = new Map();
  for (const word of words) {
    const key = `${word.block}:${word.paragraph}:${word.line}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(word);
  }

  return [...grouped.values()]
    .map((lineWords) => {
      lineWords.sort((left, right) => left.x - right.x);
      const x = Math.min(...lineWords.map((word) => word.x));
      const y = Math.min(...lineWords.map((word) => word.y));
      const right = Math.max(...lineWords.map((word) => word.x + word.width));
      const bottom = Math.max(...lineWords.map((word) => word.y + word.height));
      return {
        text: lineWords.map((word) => word.text).join(" "),
        confidence:
          Math.round(
            (lineWords.reduce((sum, word) => sum + word.confidence, 0) /
              lineWords.length) *
              100,
          ) / 100,
        x,
        y,
        width: right - x,
        height: bottom - y,
        words: lineWords,
      };
    })
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

const questionLibrary = JSON.parse(await readFile(questionsPath, "utf8"));
const allQuestions = Array.isArray(questionLibrary)
  ? questionLibrary
  : questionLibrary.questions || [];
const requestedSlides = new Set(
  process.argv
    .slice(2)
    .flatMap((value) => value.split(","))
    .flatMap((value) => {
      const [start, end] = value.split("-").map(Number);
      if (!Number.isFinite(start)) return [];
      return Number.isFinite(end)
        ? Array.from({ length: end - start + 1 }, (_, index) => start + index)
        : [start];
    }),
);
const questions = requestedSlides.size
  ? allQuestions.filter((question) => requestedSlides.has(question.sourceSlide))
  : allQuestions;

let existing = [];
try {
  existing = JSON.parse(await readFile(outputPath, "utf8"));
} catch {
  existing = [];
}
const byId = new Map(existing.map((record) => [record.id, record]));

const scheduler = createScheduler();
const workers = await Promise.all(
  Array.from({ length: workerCount }, async () => {
    const worker = await createWorker("eng", 1, {
      cachePath: "C:/Users/hachimi/AppData/Local/Temp/ssg-tesseract-cache",
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
      user_defined_dpi: "192",
    });
    scheduler.addWorker(worker);
    return worker;
  }),
);

let completed = 0;
await Promise.all(
  questions.map(async (question) => {
    const relativeImage = question.image.replace(/^\//, "");
    const imagePath = path.join(projectRoot, "public", relativeImage);
    const bytes = await readFile(imagePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const cached = byId.get(question.id);
    if (cached?.sha256 === sha256) {
      completed += 1;
      if (completed % 25 === 0 || completed === questions.length) {
        console.log(`Tesseract ${completed}/${questions.length} (cached)`);
      }
      return;
    }

    const result = await scheduler.addJob(
      "recognize",
      imagePath,
      {},
      { text: true, tsv: true },
    );
    byId.set(question.id, {
      id: question.id,
      subject: question.subject,
      sourceSlide: question.sourceSlide,
      image: question.image,
      sha256,
      confidence: Math.round(Number(result.data.confidence || 0) * 100) / 100,
      text: String(result.data.text || "").trim(),
      lines: parseTsv(result.data.tsv),
    });
    completed += 1;
    if (completed % 10 === 0 || completed === questions.length) {
      console.log(`Tesseract ${completed}/${questions.length}`);
    }
  }),
);

await scheduler.terminate();
const output = allQuestions
  .map((question) => byId.get(question.id))
  .filter(Boolean);
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${output.length} records to ${outputPath}`);
