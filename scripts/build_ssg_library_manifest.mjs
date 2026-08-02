import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "data", "ssg");
const questions = JSON.parse(await readFile(path.join(outputRoot, "questions.json"), "utf8"));

function pngDimensions(buffer) {
  if (
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const assets = [];
for (const question of questions) {
  const relativePath = question.image.replace(/^\//, "");
  const absolutePath = path.join(projectRoot, "public", relativePath);
  try {
    const [buffer, details] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    assets.push({
      questionId: question.id,
      subject: question.subject,
      sourceSlide: question.sourceSlide,
      pageId: question.pageId,
      path: question.image,
      present: true,
      bytes: details.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      dimensions: pngDimensions(buffer),
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    assets.push({
      questionId: question.id,
      subject: question.subject,
      sourceSlide: question.sourceSlide,
      pageId: question.pageId,
      path: question.image,
      present: false,
      bytes: 0,
      sha256: null,
      dimensions: null,
    });
  }
}

const presentAssets = assets.filter((asset) => asset.present);
const manifest = {
  schemaVersion: 2,
  documentId: "1jSA13wRNJPU1fIQMf-gFIM-C9l4ZmWnPC6gdE9-3E8Y",
  sourceQuestionCount: questions.length,
  expectedAssetCount: questions.length,
  presentAssetCount: presentAssets.length,
  missingAssetCount: assets.length - presentAssets.length,
  allPresentAssetsArePng: presentAssets.every((asset) => asset.dimensions),
  assets,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Built asset manifest: ${manifest.presentAssetCount}/${manifest.expectedAssetCount} images present.`);
