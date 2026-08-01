import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(projectRoot, "data", "ssg105", "source-notes.json");
const imageRoot = path.join(projectRoot, "public", "ssg105", "source");
const outputPath = path.join(imageRoot, "manifest.json");

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Asset is not a valid PNG file.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const assets = [];

for (const question of source.questions) {
  const filename = `slide-${String(question.sourceSlide).padStart(4, "0")}.png`;
  const absolutePath = path.join(imageRoot, filename);
  const buffer = await readFile(absolutePath);
  const details = await stat(absolutePath);
  const dimensions = pngDimensions(buffer);
  assets.push({
    sourceSlide: question.sourceSlide,
    pageId: new URL(question.sourceImageUrl).searchParams.get("pageid"),
    path: `/ssg105/source/${filename}`,
    bytes: details.size,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    ...dimensions,
    renderMethod:
      question.sourceSlide <= 396
        ? "authenticated-viewpage-download"
        : "authenticated-viewpage-render",
  });
}

const manifest = {
  schemaVersion: 1,
  subject: source.subject,
  sourceFile: source.sourceFile,
  sourceSha256: source.sourceSha256,
  documentId: "1jSA13wRNJPU1fIQMf-gFIM-C9l4ZmWnPC6gdE9-3E8Y",
  revision: 1668,
  firstSlide: source.firstQuestionSlide,
  lastSlide: source.lastQuestionSlide,
  assetCount: assets.length,
  assets,
};

await mkdir(imageRoot, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${assets.length} SSG105 image records to ${outputPath}`);
