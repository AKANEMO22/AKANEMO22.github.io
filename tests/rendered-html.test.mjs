import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const examIds = ["SP26-FE", "FA25-FE", "SU25-FE", "FA24-RE"];

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the SSG105 practice dashboard", async () => {
  const response = await render("/ssg105");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>SSG105 Practice Lab<\/title>/i);
  assert.match(html, /Ba lượt, mỗi lượt đúng 50 câu/);
  assert.match(html, /Đã kiểm chứng/);
  assert.match(html, /<dd>130(?:<!-- -->)?\/130<\/dd>/);
  assert.match(html, /href="\/ssg105"/);
});

test("SSG105 canonical bank has 130 verified questions and three 50-question sets", async () => {
  const [questions, exams, stats, manifest] = await Promise.all([
    readFile(new URL("../data/ssg105/questions.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/ssg105/exams.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/ssg105/stats.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/ssg105/source/manifest.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  assert.equal(questions.length, 130);
  assert.equal(questions.filter((question) => question.verification.status === "verified").length, 130);
  assert.deepEqual(exams.map((exam) => exam.questionIds.length), [50, 50, 50]);
  assert.equal(new Set(exams.flatMap((exam) => exam.questionIds)).size, 130);
  assert.equal(stats.repeatedForPractice.length, 20);
  assert.equal(manifest.assets.length, 130);
  assert.equal(new Set(manifest.assets.map((asset) => asset.sha256)).size, 130);
});

test("server-renders the ADY201m study dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ADY Study Lab — Luyện 4 đề ADY201m<\/title>/i);
  assert.match(html, /Học theo đề thật/);
  assert.match(html, /<strong>200<\/strong><span>ảnh câu hỏi gốc<\/span>/);
  assert.match(html, /Bốn mốc thi, một mục tiêu/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("comparison report contains the manually audited pair counts", async () => {
  const report = JSON.parse(
    await readFile(new URL("../data/comparison.json", import.meta.url), "utf8"),
  );
  const expected = new Map([
    ["SP26-FE|FA25-FE", [1, 1]],
    ["SP26-FE|SU25-FE", [5, 5]],
    ["SP26-FE|FA24-RE", [7, 7]],
    ["FA25-FE|SU25-FE", [12, 13]],
    ["FA25-FE|FA24-RE", [7, 7]],
    ["SU25-FE|FA24-RE", [7, 7]],
  ]);

  assert.equal(report.pairs.length, 6);
  for (const pair of report.pairs) {
    assert.deepEqual(
      [pair.exactCount, pair.similarCount],
      expected.get(`${pair.left}|${pair.right}`),
    );
    assert.equal(pair.exactPercent, pair.exactCount * 2);
    assert.equal(pair.similarPercent, pair.similarCount * 2);
  }
});

test("learn mode is infographic-first and keeps long text collapsed", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /className="visual-learning-board"/);
  assert.match(source, /className="visual-flow"/);
  assert.match(source, /className="visual-option-map"/);
  assert.match(source, /className="memory-ribbon"/);
  assert.match(source, /className="full-explanation-card"/);
  assert.doesNotMatch(
    source,
    /<details className="full-explanation-card" open>/,
  );
  assert.doesNotMatch(
    source,
    /<details className="translation-panel" open>/,
  );
});

test("OCR-sensitive questions retain tables, code, and full scenarios", async () => {
  const sp26 = JSON.parse(
    await readFile(new URL("../data/exams/SP26-FE.json", import.meta.url), "utf8"),
  );
  const su25 = JSON.parse(
    await readFile(new URL("../data/exams/SU25-FE.json", import.meta.url), "utf8"),
  );

  const zTableQuestion = sp26.find((question) => question.number === 34);
  assert.match(zTableQuestion.question, /Given a portion of the Z-score table/);
  assert.match(zTableQuestion.question, /-2\.3\s*\|\s*0\.0107/);
  assert.match(zTableQuestion.question, /-2\.1\s*\|\s*0\.0179/);

  const dataFrameQuestion = su25.find((question) => question.number === 9);
  assert.match(dataFrameQuestion.question, /product_data\s*=/);
  assert.match(dataFrameQuestion.question, /150,\s*180,\s*50,\s*120,\s*210/);

  const drugQuestion = su25.find((question) => question.number === 42);
  assert.match(drugQuestion.question, /sample of 50 participants/);
  assert.match(drugQuestion.question, /standard deviation of 2 mmHg/);
});

for (const examId of examIds) {
  test(`${examId} contains 50 verified questions, images, and full lessons`, async () => {
    const dataUrl = new URL(`../data/exams/${examId}.json`, import.meta.url);
    const questions = JSON.parse(await readFile(dataUrl, "utf8"));
    const lessonUrl = new URL(`../data/lessons/${examId}.json`, import.meta.url);
    const lessons = JSON.parse(await readFile(lessonUrl, "utf8"));

    assert.equal(questions.length, 50);
    assert.equal(lessons.length, 50);
    assert.deepEqual(
      questions.map((question) => question.number),
      Array.from({ length: 50 }, (_, index) => index + 1),
    );

    for (const question of questions) {
      assert.equal(question.exam, examId);
      assert.equal(question.verified, true);
      assert.ok(question.question.trim().length > 5);
      assert.ok(Array.isArray(question.options));
      assert.ok(question.options.length >= 2 && question.options.length <= 6);
      assert.ok(
        Number.isInteger(question.answer) &&
          question.answer >= 0 &&
          question.answer < question.options.length,
      );
      assert.ok(question.explanation.trim().length > 4);

      const imageUrl = new URL(`public${question.image}`, projectRoot);
      await access(imageUrl);
    }

    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    for (const question of questions) {
      const lesson = lessonById.get(question.id);
      assert.ok(lesson);
      assert.equal(lesson.optionAnalysis.length, question.options.length);
      assert.equal(
        lesson.optionAnalysis.filter((option) => option.verdict === "correct")
          .length,
        1,
      );
      assert.equal(
        lesson.optionAnalysis[question.answer].verdict,
        "correct",
      );
      assert.ok(lesson.translation.question.length >= 8);
      assert.equal(
        lesson.translation.options.length,
        question.options.length,
      );
      assert.ok(lesson.visualLearning.takeaway.length <= 120);
      assert.ok(lesson.visualLearning.rule.length <= 100);
      assert.ok(lesson.visualLearning.memoryHook.length <= 110);
      assert.ok(lesson.visualLearning.flow.length >= 3);
      assert.ok(lesson.visualLearning.flow.length <= 5);
      assert.ok(
        lesson.visualLearning.flow.some((node) => node.kind === "result"),
      );
      assert.equal(
        lesson.visualLearning.optionCues.length,
        question.options.length,
      );
      assert.ok(
        lesson.visualLearning.optionCues.every(
          (cue) => cue.length >= 15 && cue.length <= 85,
        ),
      );
      assert.ok(lesson.concept.summary.length >= 180);
      assert.ok(lesson.whyCorrect.length >= 200);
      assert.ok(
        lesson.optionAnalysis.every(
          (analysis) => analysis.explanation.length >= 100,
        ),
      );
      assert.ok(lesson.example.scenario.length >= 150);
      assert.ok(lesson.example.takeaway.length >= 80);
      assert.ok(lesson.visual.items.length >= 2);
      assert.ok(lesson.visual.caption.length >= 70);
      assert.ok(lesson.deepDive.mechanism.length >= 180);
      assert.ok(lesson.deepDive.reasoningSteps.length >= 3);
      assert.ok(
        lesson.deepDive.reasoningSteps.every((step) => step.length >= 55),
      );
      assert.ok(lesson.deepDive.commonMistake.length >= 100);
      assert.ok(lesson.deepDive.examTip.length >= 80);
    }
  });
}
