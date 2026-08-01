import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const examDir = path.join(projectRoot, "data", "exams");
const outputPath = path.join(projectRoot, "data", "comparison.json");
const examIds = ["SP26-FE", "FA25-FE", "SU25-FE", "FA24-RE"];
const approvedParaphrases = new Set(["FA25-FE:20|SU25-FE:26"]);

const exams = Object.fromEntries(
  examIds.map((id) => [
    id,
    JSON.parse(fs.readFileSync(path.join(examDir, `${id}.json`), "utf8")),
  ]),
);

function normalize(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(
    normalize(text)
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

function diceSimilarity(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return (2 * overlap) / (leftTokens.size + rightTokens.size || 1);
}

function editSimilarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return 1 - previous[b.length] / Math.max(a.length, b.length, 1);
}

function combinedSimilarity(left, right) {
  const tokenScore = diceSimilarity(left, right);
  const characterScore = editSimilarity(left, right);
  return Math.max(characterScore, 0.55 * tokenScore + 0.45 * characterScore);
}

function comparePair(leftId, rightId) {
  const candidates = [];

  for (const leftQuestion of exams[leftId]) {
    for (const rightQuestion of exams[rightId]) {
      const exact =
        normalize(leftQuestion.question) === normalize(rightQuestion.question);
      const approvedParaphrase = approvedParaphrases.has(
        `${leftId}:${leftQuestion.number}|${rightId}:${rightQuestion.number}`,
      );
      candidates.push({
        leftQuestion: leftQuestion.number,
        rightQuestion: rightQuestion.number,
        exact,
        approvedParaphrase,
        similarity: exact
          ? 1
          : combinedSimilarity(leftQuestion.question, rightQuestion.question),
        question: leftQuestion.question,
      });
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);
  const usedLeft = new Set();
  const usedRight = new Set();
  const matches = [];

  for (const candidate of candidates) {
    if (
      (!candidate.exact && !candidate.approvedParaphrase) ||
      usedLeft.has(candidate.leftQuestion) ||
      usedRight.has(candidate.rightQuestion)
    ) {
      continue;
    }
    usedLeft.add(candidate.leftQuestion);
    usedRight.add(candidate.rightQuestion);
    matches.push({
      ...candidate,
      similarity: Number(candidate.similarity.toFixed(3)),
    });
  }

  const exactMatches = matches.filter((match) => match.exact);

  return {
    left: leftId,
    right: rightId,
    exactCount: exactMatches.length,
    exactPercent: exactMatches.length * 2,
    similarCount: matches.length,
    similarPercent: matches.length * 2,
    matches,
  };
}

const pairs = [];
for (let leftIndex = 0; leftIndex < examIds.length; leftIndex += 1) {
  for (
    let rightIndex = leftIndex + 1;
    rightIndex < examIds.length;
    rightIndex += 1
  ) {
    pairs.push(comparePair(examIds[leftIndex], examIds[rightIndex]));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  method: {
    exact:
      "So sánh câu hỏi sau khi chuẩn hóa chữ thường, dấu câu và khoảng trắng.",
    similar:
      "Tính thêm các câu đổi cách diễn đạt sau khi AI agent đối chiếu thủ công nội dung và loại các cặp chỉ giống mẫu câu nhưng khác kiến thức.",
  },
  pairs,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
