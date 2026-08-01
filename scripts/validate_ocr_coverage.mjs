import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const examIds = ["SP26-FE", "FA25-FE", "SU25-FE", "FA24-RE"];
const errors = [];

// These images were checked directly because the historical OCR crop did not
// contain enough pixels to compare reliably. Their image hashes are still
// verified below, so replacing an image forces a fresh review.
const visualQuestionChecks = new Set([
  "FA24-RE-Q24",
  "FA24-RE-Q29",
  "SU25-FE-Q3",
  "SU25-FE-Q34",
]);
const visualOptionChecks = new Set(["FA24-RE-Q24"]);

function readJson(...segments) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, ...segments), "utf8"),
  );
}

function normalize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isBoilerplate(value) {
  const text = normalize(value);
  return (
    !text ||
    text.includes("multiplechoice") ||
    text.startsWith("fuoverflow") ||
    text.startsWith("kizspy") ||
    text.includes("choose1answer") ||
    /^(?:kizspy)?question\d+$/.test(text) ||
    text === "question"
  );
}

function diceSimilarity(left, right) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const pairs = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }

  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const remaining = pairs.get(pair) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      pairs.set(pair, remaining - 1);
    }
  }

  return (2 * overlap) / (left.length + right.length - 2);
}

function levenshtein(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] +
          (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function extractQuestion(lines) {
  const output = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (/^\s*A\s*[.():]/i.test(text)) break;
    if (!isBoilerplate(text)) output.push(text);
  }
  return normalize(output.join(" "));
}

function extractOptions(lines) {
  const options = new Map();
  let current = null;

  for (const line of lines) {
    const text = line.text.trim();
    const label = text.match(/^\s*([A-E])\s*[.():]\s*(.*)$/i);
    if (label) {
      current = label[1].toUpperCase().charCodeAt(0) - 65;
      options.set(current, label[2]);
      continue;
    }
    if (current !== null && !isBoilerplate(text)) {
      options.set(current, `${options.get(current)} ${text}`.trim());
    }
  }

  return options;
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

let imageCount = 0;
let optionCount = 0;
let visualFallbackCount = 0;

for (const examId of examIds) {
  const questions = readJson("data", "exams", `${examId}.json`);
  const rawEntries = readJson("data", "ocr-raw", `${examId}.json`);
  const rawByNumber = new Map(rawEntries.map((entry) => [entry.question, entry]));

  if (questions.length !== 50 || rawEntries.length !== 50) {
    errors.push(
      `${examId}: expected 50 questions and 50 OCR records, got ${questions.length}/${rawEntries.length}`,
    );
  }

  for (const question of questions) {
    const label = `${examId}-Q${question.number}`;
    const raw = rawByNumber.get(question.number);
    if (!raw) {
      errors.push(`${label}: missing raw OCR record`);
      continue;
    }

    const imagePath = path.join(
      projectRoot,
      "public",
      ...raw.image.replace(/^\//, "").split("/"),
    );
    if (!fs.existsSync(imagePath)) {
      errors.push(`${label}: source image does not exist`);
      continue;
    }
    if (question.image !== raw.image) {
      errors.push(`${label}: structured data points to a different source image`);
    }
    if (sha256(imagePath) !== raw.sha256) {
      errors.push(`${label}: source image hash changed; repeat OCR review`);
    }
    imageCount += 1;

    const passes = [raw.pass_original, raw.pass_thresholded];
    const normalizedQuestion = normalize(question.question);
    const questionSimilarity = Math.max(
      ...passes.map((lines) =>
        diceSimilarity(extractQuestion(lines), normalizedQuestion),
      ),
    );

    if (questionSimilarity < 0.88) {
      if (!visualQuestionChecks.has(label)) {
        errors.push(
          `${label}: question OCR coverage is ${(questionSimilarity * 100).toFixed(1)}%`,
        );
      } else {
        visualFallbackCount += 1;
      }
    }

    const parsedPasses = passes.map(extractOptions);
    question.options.forEach((option, index) => {
      optionCount += 1;
      const candidates = parsedPasses
        .filter((parsed) => parsed.has(index))
        .map((parsed) => normalize(parsed.get(index)));
      const expected = normalize(option);

      if (candidates.length === 0) {
        if (!visualOptionChecks.has(label)) {
          errors.push(`${label}${String.fromCharCode(65 + index)}: missing OCR option`);
        }
        return;
      }

      if (expected.length < 12) {
        const distance = Math.min(
          ...candidates.map((candidate) => levenshtein(candidate, expected)),
        );
        const tolerance = Math.max(2, Math.ceil(expected.length * 0.3));
        if (distance > tolerance) {
          errors.push(
            `${label}${String.fromCharCode(65 + index)}: short option differs from OCR`,
          );
        }
        return;
      }

      const similarity = Math.max(
        ...candidates.map((candidate) => diceSimilarity(candidate, expected)),
      );
      if (similarity < 0.9) {
        errors.push(
          `${label}${String.fromCharCode(65 + index)}: option OCR coverage is ${(similarity * 100).toFixed(1)}%`,
        );
      }
    });
  }
}

if (errors.length > 0) {
  console.error(`OCR coverage failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `OCR coverage passed: ${imageCount}/200 source images, ${optionCount} options, ${visualFallbackCount} image-level fallbacks.`,
);
