"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  EXAMS,
  ROADMAP,
  type Exam,
  type ExamId,
  type ExamQuestion,
} from "./exam-data";
import comparison from "../data/comparison.json";
import { getLesson } from "./lesson-data";
import type { QuestionLesson } from "./lesson-types";

type Mode = "learn" | "test";
type Screen = "dashboard" | "quiz" | "results";
type Answer = number | null;
type Stats = Record<ExamId, { attempts: number; best: number }>;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const STATS_KEY = "ady201m-exam-stats-v1";
const ROADMAP_KEY = "ady201m-roadmap-v1";

const EMPTY_STATS = Object.fromEntries(
  EXAMS.map((exam) => [exam.id, { attempts: 0, best: 0 }]),
) as Stats;

function readSavedStats(): Stats {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "{}");
    const result = { ...EMPTY_STATS };
    for (const exam of EXAMS) {
      const value = parsed?.[exam.id];
      if (
        value &&
        Number.isFinite(value.attempts) &&
        value.attempts >= 0 &&
        Number.isFinite(value.best) &&
        value.best >= 0 &&
        value.best <= 50
      ) {
        result[exam.id] = {
          attempts: Math.floor(value.attempts),
          best: Math.floor(value.best),
        };
      }
    }
    return result;
  } catch {
    return EMPTY_STATS;
  }
}

function readSavedRoadmap(): number[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROADMAP_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter(
          (value): value is number =>
            Number.isInteger(value) && value >= 0 && value < ROADMAP.length,
        ),
      ),
    );
  } catch {
    return [];
  }
}

function saveLocalValue(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The study session still works when private browsing blocks localStorage.
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${pad(minutes)}:${pad(remainder)}`;
}

function scoreLabel(score: number) {
  if (score >= 45) return "Sẵn sàng vào phòng thi";
  if (score >= 40) return "Nền tảng đang rất chắc";
  if (score >= 35) return "Gần đạt mục tiêu";
  return "Đã tìm ra phần cần vá";
}

function shortExamName(examId: string) {
  return examId.replace("-FE", "").replace("-RE", "");
}

function questionTopic(question: ExamQuestion) {
  const text = `${question.question} ${question.explanation}`.toLowerCase();
  if (
    /mean|median|variance|standard deviation|normal distribution|normally distributed|z.score|probability|percentile|confidence interval|hypothesis|t.test|chi.square|anova|correlation|quantile/.test(
      text,
    )
  ) {
    return "Xác suất & thống kê";
  }
  if (/precision|recall|f1|auc|confusion|accuracy|metric|cross.validation/.test(text)) {
    return "Đánh giá mô hình";
  }
  if (/regression|knn|svm|tree|forest|bayes|boost|bagging|cluster|k.means/.test(text)) {
    return "Thuật toán";
  }
  if (/clean|missing|scale|normal|encode|feature|preprocess|leak|imbalance/.test(text)) {
    return "Dữ liệu & pipeline";
  }
  if (/neural|cnn|activation|epoch|gradient|deep learning/.test(text)) {
    return "Deep learning";
  }
  return "Machine learning";
}

function QuestionTranscript({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  const hasStructuredBlock = blocks.some(
    (block) =>
      block.includes("\n") &&
      /(?:^|\n)\s*(?:import |from |#|[-\d.]+\s*\||Z\s+\||[A-Za-z_]\w*\s*=)/m.test(
        block,
      ),
  );
  const isDense = text.length > 210 || hasStructuredBlock;

  return (
    <div className={`question-copy${isDense ? " is-dense" : ""}`}>
      {blocks.map((block, index) => {
        const isStructured =
          block.includes("\n") &&
          /(?:^|\n)\s*(?:import |from |#|[-\d.]+\s*\||Z\s+\||[A-Za-z_]\w*\s*=)/m.test(
            block,
          );

        if (index === 0) {
          return <h1 key={`question-block-${index}`}>{block}</h1>;
        }

        if (isStructured) {
          return (
            <pre key={`question-block-${index}`} tabIndex={0}>
              {block}
            </pre>
          );
        }

        return <p key={`question-block-${index}`}>{block}</p>;
      })}
    </div>
  );
}

function ConceptIllustration({ lesson }: { lesson: QuestionLesson }) {
  return (
    <figure className={`concept-illustration visual-${lesson.visual.type}`}>
      <div className="visual-heading">
        <span>Minh họa khái niệm</span>
        <strong>{lesson.visual.title}</strong>
      </div>
      <div className="visual-items">
        {lesson.visual.items.map((item, index) => (
          <div className="visual-item" key={`${lesson.id}-visual-${index}`}>
            <span>{pad(index + 1)}</span>
            <strong>{item}</strong>
            {index < lesson.visual.items.length - 1 && (
              <i aria-hidden="true">→</i>
            )}
          </div>
        ))}
      </div>
      <figcaption>{lesson.visual.caption}</figcaption>
    </figure>
  );
}

function VisualLearningBoard({
  lesson,
  question,
}: {
  lesson: QuestionLesson;
  question: ExamQuestion;
}) {
  const visualLearning = lesson.visualLearning ?? {
    takeaway: lesson.concept.title,
    rule: lesson.example.takeaway.slice(0, 100),
    flow: lesson.visual.items.map((item, index) => ({
      label: item.slice(0, 28),
      note: item.slice(0, 85),
      kind: index === lesson.visual.items.length - 1 ? "result" : "process",
    })),
    optionCues: lesson.optionAnalysis.map((item) =>
      item.explanation.slice(0, 85),
    ),
    memoryHook: lesson.example.takeaway.slice(0, 110),
  } satisfies QuestionLesson["visualLearning"];

  return (
    <section className="visual-learning-board" aria-label="Tóm tắt trực quan">
      <header className="visual-answer-hero">
        <div className="answer-orb">
          <span>Đáp án</span>
          <strong>{LETTERS[question.answer]}</strong>
        </div>
        <div className="visual-takeaway">
          <span>Tóm tắt 15 giây</span>
          <h2>{visualLearning.takeaway}</h2>
        </div>
        <div className="visual-rule">
          <span>Quy tắc chốt</span>
          <strong>{visualLearning.rule}</strong>
        </div>
      </header>

      <div className="visual-flow" role="list" aria-label="Luồng suy luận">
        {visualLearning.flow.map((node, index) => (
          <div
            className={`visual-flow-node node-${node.kind}`}
            role="listitem"
            key={`${lesson.id}-visual-flow-${index}`}
          >
            <span>{pad(index + 1)}</span>
            <div>
              <strong>{node.label}</strong>
              <small>{node.note}</small>
            </div>
            {index < visualLearning.flow.length - 1 && (
              <i aria-hidden="true">→</i>
            )}
          </div>
        ))}
      </div>

      <div
        className="visual-option-map"
        role="list"
        aria-label="Bản đồ các lựa chọn"
      >
        {visualLearning.optionCues.map((cue, index) => {
          const isCorrect = index === question.answer;
          return (
            <article
              className={isCorrect ? "visual-option-correct" : "visual-option-wrong"}
              role="listitem"
              key={`${lesson.id}-visual-option-${index}`}
            >
              <div>
                <strong>{LETTERS[index]}</strong>
                <span>{isCorrect ? "✓ Chọn" : "× Loại"}</span>
              </div>
              <p>{cue}</p>
            </article>
          );
        })}
      </div>

      <div className="memory-ribbon">
        <span aria-hidden="true">◆</span>
        <div>
          <small>Móc ghi nhớ</small>
          <strong>{visualLearning.memoryHook}</strong>
        </div>
      </div>
    </section>
  );
}

function LessonPanel({
  lesson,
  question,
}: {
  lesson: QuestionLesson;
  question: ExamQuestion;
}) {
  const translation = lesson.translation ?? {
    question: question.question,
    options: question.options,
  };
  const deepDive = lesson.deepDive ?? {
    mechanism: lesson.concept.summary,
    reasoningSteps: [lesson.whyCorrect, lesson.example.takeaway, lesson.visual.caption],
    commonMistake: "Phần giải thích chuyên sâu đang được bổ sung.",
    examTip: lesson.example.takeaway,
  };

  return (
    <section className="lesson-panel" aria-label={`Bài giảng câu ${question.number}`}>
      <details className="translation-panel">
        <summary>
          <span>Bản dịch đề</span>
          <strong>Đọc câu hỏi và lựa chọn bằng tiếng Việt</strong>
        </summary>
        <div className="translation-content">
          <h2>{translation.question}</h2>
          <div>
            {translation.options.map((option, index) => (
              <p key={`${lesson.id}-translation-${index}`}>
                <strong>{LETTERS[index]}</strong>
                <span>{option}</span>
              </p>
            ))}
          </div>
        </div>
      </details>

      <VisualLearningBoard lesson={lesson} question={question} />
      <ConceptIllustration lesson={lesson} />

      <details className="full-explanation-card">
        <summary>
          <span>Đọc thêm khi cần</span>
          <strong>Mở bản giải thích đầy đủ bằng chữ</strong>
        </summary>

        <div className="full-explanation-content">
          <header className="lesson-header">
            <div>
              <span>Bài học từ câu này</span>
              <h2>{lesson.concept.title}</h2>
            </div>
            <span className="correct-answer-chip">
              Đáp án {LETTERS[question.answer]}
            </span>
            <p>{lesson.concept.summary}</p>
          </header>

          <article className="why-correct">
            <span>Vì sao chọn {LETTERS[question.answer]}?</span>
            <h3>{question.options[question.answer]}</h3>
            <p>{lesson.whyCorrect}</p>
          </article>

          <section className="deep-dive-card">
            <div className="deep-dive-static-title">
              <span>Giải thích chuyên sâu</span>
              <strong>Cơ chế và lập luận từng bước</strong>
            </div>
            <div className="deep-dive-content">
              <article className="mechanism-card">
                <span>Bản chất hoạt động</span>
                <p>{deepDive.mechanism}</p>
              </article>

              <article className="reasoning-card">
                <span>Cách suy luận đến đáp án</span>
                <ol>
                  {deepDive.reasoningSteps.map((step, index) => (
                    <li key={`${lesson.id}-reasoning-${index}`}>
                      <strong>{pad(index + 1)}</strong>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </article>

              <div className="deep-dive-notes">
                <article className="mistake-card">
                  <span>Bẫy dễ nhầm</span>
                  <p>{deepDive.commonMistake}</p>
                </article>
                <article className="exam-tip-card">
                  <span>Mẹo làm bài</span>
                  <p>{deepDive.examTip}</p>
                </article>
              </div>
            </div>
          </section>

          <div className="lesson-columns">
            <article className="option-analysis-card">
              <div className="lesson-card-title">
                <span>Phân tích</span>
                <h3>Từng phương án nói gì?</h3>
              </div>
              <div className="option-analysis-list">
                {lesson.optionAnalysis.map((item, index) => (
                  <div
                    className={item.verdict === "correct" ? "analysis-correct" : "analysis-wrong"}
                    key={`${lesson.id}-analysis-${index}`}
                  >
                    <strong>{item.letter}</strong>
                    <div>
                      <span>{item.verdict === "correct" ? "Đúng" : "Không chọn"}</span>
                      <p>{item.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="example-card">
              <div className="lesson-card-title">
                <span>Ví dụ dễ hiểu</span>
                <h3>{lesson.example.title}</h3>
              </div>
              <p>{lesson.example.scenario}</p>
              <div>
                <span>Điều cần nhớ</span>
                <strong>{lesson.example.takeaway}</strong>
              </div>
            </article>
          </div>
        </div>
      </details>
    </section>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeExam, setActiveExam] = useState<Exam>(EXAMS[0]);
  const [mode, setMode] = useState<Mode>("learn");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => Array(50).fill(null));
  const [finished, setFinished] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [roadmapDone, setRoadmapDone] = useState<number[]>([]);
  const imageTriggerRef = useRef<HTMLButtonElement>(null);
  const imageModalRef = useRef<HTMLDivElement>(null);
  const imageCloseRef = useRef<HTMLButtonElement>(null);

  const question = activeExam.questions[current];
  const lesson = getLesson(activeExam.id, question.id);
  const selected = answers[current];
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const isRevealed = finished || mode === "learn";
  const score = activeExam.questions.reduce(
    (total, item, index) => total + (answers[index] === item.answer ? 1 : 0),
    0,
  );
  const progress = finished ? 100 : ((current + 1) / 50) * 100;

  const wrongAnswers = useMemo(
    () =>
      activeExam.questions
        .map((item, index) => ({ item, response: answers[index] }))
        .filter(({ item, response }) => response !== item.answer),
    [activeExam, answers],
  );

  const topicResults = useMemo(() => {
    const result = new Map<string, { correct: number; total: number }>();
    activeExam.questions.forEach((item, index) => {
      const topic = questionTopic(item);
      const row = result.get(topic) ?? { correct: 0, total: 0 };
      row.total += 1;
      if (answers[index] === item.answer) row.correct += 1;
      result.set(topic, row);
    });
    return Array.from(result.entries());
  }, [activeExam, answers]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setStats(readSavedStats());
      setRoadmapDone(readSavedRoadmap());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (screen !== "quiz" || finished || !startedAt) return;
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [screen, finished, startedAt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (screen !== "quiz" || finished || imageOpen) return;

      const optionIndex = LETTERS.indexOf(event.key.toUpperCase());
      if (optionIndex >= 0 && optionIndex < question.options.length) {
        chooseAnswer(optionIndex);
      }
      if (event.key === "ArrowRight" && current < 49) setCurrent((value) => value + 1);
      if (event.key === "ArrowLeft" && current > 0) setCurrent((value) => value - 1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!imageOpen) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => imageCloseRef.current?.focus());

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setImageOpen(false);
        return;
      }
      if (event.key !== "Tab" || !imageModalRef.current) return;

      const focusable = Array.from(
        imageModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus();
    };
  }, [imageOpen]);

  function beginExam(exam: Exam, nextMode: Mode) {
    setActiveExam(exam);
    setMode(nextMode);
    setCurrent(0);
    setAnswers(Array(50).fill(null));
    setFinished(false);
    setImageOpen(false);
    setElapsed(0);
    setStartedAt(Date.now());
    setScreen("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseAnswer(option: number) {
    if (finished || mode === "learn") return;
    setAnswers((previous) => {
      const updated = [...previous];
      updated[current] = option;
      return updated;
    });
  }

  function goToQuestion(index: number) {
    setCurrent(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function completeExam() {
    const finalScore = activeExam.questions.reduce(
      (total, item, index) => total + (answers[index] === item.answer ? 1 : 0),
      0,
    );
    const nextStats = {
      ...stats,
      [activeExam.id]: {
        attempts: stats[activeExam.id].attempts + 1,
        best: Math.max(stats[activeExam.id].best, finalScore),
      },
    };
    setStats(nextStats);
    saveLocalValue(STATS_KEY, nextStats);
    setFinished(true);
    setScreen("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleRoadmap(index: number) {
    const updated = roadmapDone.includes(index)
      ? roadmapDone.filter((item) => item !== index)
      : [...roadmapDone, index];
    setRoadmapDone(updated);
    saveLocalValue(ROADMAP_KEY, updated);
  }

  function returnHome() {
    setScreen("dashboard");
    setFinished(false);
    setImageOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "dashboard") {
    return (
      <main className="dashboard-shell">
        <nav className="nav-bar" aria-label="Điều hướng chính">
          <a className="brand" href="#top" aria-label="ADY Study Lab">
            <span className="brand-mark">A</span>
            <span>
              <strong>ADY Study Lab</strong>
              <small>4 đề gốc · 200 câu</small>
            </span>
          </a>
          <div className="subject-tabs" role="navigation" aria-label="Chọn môn">
            <Link className="is-active" href="/" aria-current="page">ADY201m</Link>
            <Link href="/mas202">MAS202</Link>
            <Link href="/ssg105">SSG105</Link>
          </div>
          <div className="nav-links">
            <a href="#de-thi">Đề thi</a>
            <a href="#trung-de">Trùng đề</a>
            <a href="#lo-trinh">Lộ trình</a>
            <span className="verified-chip">OCR ×2 đã đối chiếu</span>
          </div>
        </nav>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="kicker">ADY201m · Exam practice system</p>
            <h1>
              Học theo đề thật.
              <br />
              <em>Biết chính xác</em> mình hổng ở đâu.
            </h1>
            <p className="hero-intro">
              Bốn đề gần nhất, mỗi đề đúng 50 câu. Chế độ học ưu tiên infographic,
              luồng suy luận và thẻ màu; bản dịch cùng phần chữ đầy đủ chỉ mở khi
              cần. Chế độ kiểm tra vẫn mô phỏng thi và giữ ảnh gốc độ phân giải cao.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={() => beginExam(EXAMS[0], "test")}>
                Làm đề mới nhất
                <span aria-hidden="true">↗</span>
              </button>
              <a href="#lo-trinh">Xem lộ trình 7 ngày</a>
            </div>
          </div>

          <div className="hero-board" aria-label="Tóm tắt dữ liệu">
            <div className="board-head">
              <span>Archive / ADY201m</span>
              <span>Verified 30.07.2026</span>
            </div>
            <div className="board-score">
              <strong>200</strong>
              <span>ảnh câu hỏi gốc</span>
            </div>
            <div className="board-grid">
              <div>
                <span>Độ phân giải</span>
                <strong>1920 px</strong>
              </div>
              <div>
                <span>Đề thi</span>
                <strong>4 × 50</strong>
              </div>
              <div>
                <span>Infographic</span>
                <strong>200 / 200</strong>
              </div>
              <div>
                <span>Lưu tiến độ</span>
                <strong>Trên máy</strong>
              </div>
            </div>
            <div className="board-strip">
              {EXAMS.map((exam) => (
                <i key={exam.id} style={{ background: exam.accent }} />
              ))}
            </div>
          </div>
        </section>

        <section className="exam-section" id="de-thi">
          <div className="section-title">
            <div>
              <p className="kicker">01 / Chọn đề</p>
              <h2>Bốn mốc thi, một mục tiêu.</h2>
            </div>
            <p>
              “Học” phản hồi ngay sau mỗi câu. “Kiểm tra” giữ kín đáp án đến lúc
              nộp bài.
            </p>
          </div>

          <div className="exam-grid">
            {EXAMS.map((exam, index) => (
              <article className="exam-card" key={exam.id}>
                <div className="exam-card-top">
                  <span style={{ background: exam.accent }}>{pad(index + 1)}</span>
                  <p>{exam.date}</p>
                </div>
                <div>
                  <span className="exam-type">{exam.type} · {exam.campus}</span>
                  <h3>{exam.label}</h3>
                  <p>50 câu · 50 infographic · bản dịch · ảnh gốc 1920 px</p>
                </div>
                <div className="exam-progress">
                  <span>
                    Kỷ lục <strong>{stats[exam.id].best}/50</strong>
                  </span>
                  <span>
                    {stats[exam.id].attempts} lượt đã làm
                  </span>
                </div>
                <div className="exam-actions">
                  <button type="button" onClick={() => beginExam(exam, "learn")}>
                    Học & xem giải thích
                  </button>
                  <button type="button" onClick={() => beginExam(exam, "test")}>
                    Kiểm tra
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="comparison-section" id="trung-de">
          <div className="section-title comparison-title">
            <div>
              <p className="kicker">02 / Độ trùng đề</p>
              <h2>Câu nào đã xuất hiện lại?</h2>
            </div>
            <p>
              “Trùng hoàn toàn” là cùng nội dung câu hỏi sau khi chuẩn hóa dấu câu.
              “Cùng ý” tính thêm câu đổi cách diễn đạt hoặc dùng lại cùng cấu trúc.
            </p>
          </div>

          <div className="comparison-grid">
            {comparison.pairs.map((pair) => (
              <article className="comparison-card" key={`${pair.left}-${pair.right}`}>
                <div className="comparison-card-head">
                  <strong>{shortExamName(pair.left)}</strong>
                  <span aria-hidden="true">↔</span>
                  <strong>{shortExamName(pair.right)}</strong>
                </div>
                <div className="overlap-score">
                  <strong>{pair.exactPercent}%</strong>
                  <span>{pair.exactCount}/50 câu trùng hoàn toàn</span>
                </div>
                <p>
                  Tính cả câu cùng ý: <strong>{pair.similarCount}/50 câu ({pair.similarPercent}%)</strong>
                </p>
                <details>
                  <summary>Xem các cặp câu</summary>
                  <div className="overlap-pairs">
                    {pair.matches.map((match) => (
                      <span key={`${match.leftQuestion}-${match.rightQuestion}`}>
                        Câu {match.leftQuestion} ↔ Câu {match.rightQuestion}
                        {!match.exact && <small>Cùng ý</small>}
                      </span>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="roadmap-section" id="lo-trinh">
          <div className="section-title roadmap-title">
            <div>
              <p className="kicker">03 / Lộ trình</p>
              <h2>7 ngày để vượt mốc 43/50.</h2>
            </div>
            <div className="roadmap-meter">
              <strong>{roadmapDone.length}/7</strong>
              <span>ngày hoàn thành</span>
            </div>
          </div>

          <div className="roadmap-list">
            {ROADMAP.map((item, index) => {
              const done = roadmapDone.includes(index);
              return (
                <article className={done ? "is-done" : ""} key={item.day}>
                  <button
                    type="button"
                    onClick={() => toggleRoadmap(index)}
                    aria-label={`${done ? "Bỏ đánh dấu" : "Đánh dấu"} ${item.day}`}
                    aria-pressed={done}
                  >
                    {done ? "✓" : pad(index + 1)}
                  </button>
                  <span>{item.day}</span>
                  <h3>{item.title}</h3>
                  <p>{item.note}</p>
                  <strong>{item.target}</strong>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="site-footer">
          <div>
            <strong>ADY Study Lab</strong>
            <span>Dữ liệu lưu cục bộ trên thiết bị của bạn.</span>
          </div>
          <p>200 ảnh gốc · 200 bản dịch · 200 infographic</p>
        </footer>
      </main>
    );
  }

  if (screen === "results") {
    return (
      <main className="result-shell">
        <nav className="quiz-nav">
          <button className="mini-brand" type="button" onClick={returnHome}>
            <span>A</span>
            ADY Study Lab
          </button>
          <div>
            <span>{activeExam.label}</span>
            <button type="button" onClick={returnHome}>Về thư viện</button>
          </div>
        </nav>

        <section className="result-hero">
          <div className="result-score">
            <span>Kết quả</span>
            <strong>{score}</strong>
            <small>/ 50</small>
          </div>
          <div className="result-copy">
            <p className="kicker">{activeExam.id} · {formatTime(elapsed)}</p>
            <h1>{scoreLabel(score)}</h1>
            <p>
              Bạn đạt {score * 2}%. Hệ thống đã gom {wrongAnswers.length} câu cần
              xem lại và giữ nguyên ảnh gốc để bạn đối chiếu.
            </p>
            <div className="result-actions">
              <button type="button" onClick={() => beginExam(activeExam, mode)}>
                Làm lại đề này
              </button>
              <button type="button" onClick={returnHome}>Chọn đề khác</button>
            </div>
          </div>
        </section>

        <section className="result-grid">
          <article className="analysis-card">
            <div className="card-heading">
              <div>
                <p className="kicker">Phân tích</p>
                <h2>Theo nhóm kiến thức</h2>
              </div>
              <span>Kỷ lục {stats[activeExam.id].best}/50</span>
            </div>
            <div className="topic-list">
              {topicResults.map(([topic, value]) => (
                <div key={topic}>
                  <span>{topic}</span>
                  <div><i style={{ width: `${(value.correct / value.total) * 100}%` }} /></div>
                  <strong>{value.correct}/{value.total}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="review-card">
            <div className="card-heading">
              <div>
                <p className="kicker">Ôn lại</p>
                <h2>{wrongAnswers.length ? `${wrongAnswers.length} câu cần vá` : "Không có câu sai"}</h2>
              </div>
            </div>
            {wrongAnswers.length ? (
              <div className="wrong-list">
                {wrongAnswers.map(({ item, response }) => (
                  <article key={item.id}>
                    <span>Câu {pad(item.number)}</span>
                    <h3>{item.question}</h3>
                    <p>
                      Đáp án đúng: <strong>{LETTERS[item.answer]}. {item.options[item.answer]}</strong>
                    </p>
                    {response !== null && (
                      <small>Bạn chọn: {LETTERS[response]}. {item.options[response]}</small>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="perfect-state">Trọn vẹn 50/50. Bạn đã sẵn sàng.</p>
            )}
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <nav className="quiz-nav">
        <button className="mini-brand" type="button" onClick={returnHome}>
          <span>A</span>
          ADY Study Lab
        </button>
        <div className="quiz-nav-meta">
          <span>{activeExam.label} · {mode === "learn" ? "Học" : "Kiểm tra"}</span>
          <strong>{formatTime(elapsed)}</strong>
          <button type="button" onClick={returnHome}>Thoát</button>
        </div>
      </nav>

      <div className="quiz-progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <section className="quiz-workspace">
        <aside className="question-map">
          <div>
            <p className="kicker">Bản đồ đề</p>
            <h2>{activeExam.id}</h2>
            <span>
              {mode === "learn"
                ? "50 bài giảng · đáp án mở sẵn"
                : `${answeredCount}/50 đã trả lời`}
            </span>
          </div>
          <div className="number-grid" aria-label="Danh sách câu hỏi">
            {activeExam.questions.map((item, index) => {
              const response = answers[index];
              const learnedCorrect =
                mode === "learn" && response !== null && response === item.answer;
              const learnedWrong =
                mode === "learn" && response !== null && response !== item.answer;
              return (
                <button
                  className={[
                    index === current ? "is-current" : "",
                    response !== null ? "is-answered" : "",
                    learnedCorrect ? "is-correct" : "",
                    learnedWrong ? "is-wrong" : "",
                  ].join(" ")}
                  type="button"
                  key={item.id}
                  onClick={() => goToQuestion(index)}
                  aria-label={`Câu ${item.number}`}
                  aria-current={index === current ? "step" : undefined}
                >
                  {item.number}
                </button>
              );
            })}
          </div>
          <div className="map-legend">
            {mode === "learn" ? (
              <span><i /> Chọn số câu để đọc bài giảng</span>
            ) : (
              <>
                <span><i /> Chưa làm</span>
                <span><i /> Đã chọn</span>
              </>
            )}
          </div>
        </aside>

        <section className="question-stage">
          <div className="question-toolbar">
            <div>
              <span className="question-count">Câu {pad(current + 1)} / 50</span>
              <span className="topic-chip">{questionTopic(question)}</span>
            </div>
            <button
              className="image-button"
              type="button"
              onClick={() => setImageOpen(true)}
              ref={imageTriggerRef}
            >
              <span aria-hidden="true">⌗</span>
              Xem ảnh gốc
            </button>
          </div>

          <QuestionTranscript text={question.question} />

          <div className="option-list" role="group" aria-label="Các phương án">
            {question.options.map((option, index) => {
              const picked = selected === index;
              const correct = isRevealed && question.answer === index;
              const wrong = isRevealed && picked && question.answer !== index;
              return (
                <button
                  className={[
                    "option-button",
                    picked ? "is-picked" : "",
                    correct ? "is-correct" : "",
                    wrong ? "is-wrong" : "",
                  ].join(" ")}
                  type="button"
                  key={`${question.id}-${index}`}
                  onClick={() => chooseAnswer(index)}
                  aria-pressed={picked}
                  disabled={mode === "learn"}
                >
                  <span>{LETTERS[index]}</span>
                  <strong>{option}</strong>
                  {correct && <i aria-label="Đúng">✓</i>}
                  {wrong && <i aria-label="Sai">×</i>}
                </button>
              );
            })}
          </div>

          {mode === "learn" && <LessonPanel lesson={lesson} question={question} />}

          <div className="question-controls">
            <button
              type="button"
              onClick={() => setCurrent((value) => value - 1)}
              disabled={current === 0}
            >
              ← Câu trước
            </button>
            <span>A–E để chọn · ← → để chuyển câu</span>
            {current < 49 ? (
              <button type="button" onClick={() => setCurrent((value) => value + 1)}>
                Câu tiếp →
              </button>
            ) : mode === "learn" ? (
              <button className="submit-button" type="button" onClick={returnHome}>
                Hoàn tất bài học
              </button>
            ) : (
              <button className="submit-button" type="button" onClick={completeExam}>
                Nộp bài ({answeredCount}/50)
              </button>
            )}
          </div>

          {mode === "test" && current < 49 && (
            <button className="early-submit" type="button" onClick={completeExam}>
              Nộp bài ngay
            </button>
          )}
        </section>
      </section>

      {imageOpen && (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh câu hỏi gốc"
          ref={imageModalRef}
        >
          <button className="modal-backdrop" type="button" onClick={() => setImageOpen(false)} aria-label="Đóng" />
          <div className="image-modal-card">
            <div>
              <p>
                <strong>{activeExam.id} · Câu {pad(question.number)}</strong>
                <span>Ảnh tải trực tiếp từ bài đính kèm · 1920 px</span>
              </p>
              <button
                type="button"
                onClick={() => setImageOpen(false)}
                aria-label="Đóng ảnh"
                ref={imageCloseRef}
              >
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- keep the exact source pixels for OCR comparison */}
            <img src={question.image} alt={`Ảnh gốc câu ${question.number} đề ${activeExam.id}`} />
          </div>
        </div>
      )}
    </main>
  );
}
