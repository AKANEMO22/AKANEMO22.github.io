"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  APPEARANCE_COUNT,
  EXAMS,
  FREQUENT_QUESTIONS,
  SOURCE_SUMMARY,
  TOPIC_STATS,
  type SsgExam,
} from "./data";

type Mode = "learn" | "test";
type Screen = "dashboard" | "quiz" | "results";
type QuestionView = "original" | "translation";
type SavedStats = Record<string, { attempts: number; best: number }>;
type AnswerSelection = number[];

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const STATS_KEY = "ssg105-exam-stats-v2";

const EMPTY_STATS = Object.fromEntries(
  EXAMS.map((exam) => [exam.id, { attempts: 0, best: 0 }]),
) as SavedStats;

function readStats() {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const value = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "{}");
    return Object.fromEntries(
      EXAMS.map((exam) => {
        const saved = value?.[exam.id];
        return [
          exam.id,
          {
            attempts: Number.isInteger(saved?.attempts) ? saved.attempts : 0,
            best: Number.isInteger(saved?.best) ? Math.min(50, saved.best) : 0,
          },
        ];
      }),
    ) as SavedStats;
  } catch {
    return EMPTY_STATS;
  }
}

function scoreMessage(score: number) {
  if (score >= 45) return "Sẵn sàng vào phòng thi";
  if (score >= 40) return "Nền tảng rất chắc";
  if (score >= 35) return "Gần đạt mục tiêu";
  return "Đã tìm ra phần cần ôn lại";
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function emptyAnswers(count: number): AnswerSelection[] {
  return Array.from({ length: count }, () => []);
}

function isSameSelection(selected: AnswerSelection, expected: AnswerSelection) {
  if (expected.length === 0) return false;
  const sortedExpected = [...expected].toSorted((left, right) => left - right);
  return (
    selected.length === expected.length &&
    [...selected].toSorted((left, right) => left - right).every(
      (value, index) => value === sortedExpected[index],
    )
  );
}

export default function Ssg105Page() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [mode, setMode] = useState<Mode>("learn");
  const [activeExam, setActiveExam] = useState<SsgExam>(EXAMS[0]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswerSelection[]>(() =>
    emptyAnswers(EXAMS[0]?.questions.length ?? 50),
  );
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SavedStats>(EMPTY_STATS);
  const [imageOpen, setImageOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [questionView, setQuestionView] = useState<QuestionView>("original");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStats(readStats()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (screen !== "quiz" || finished) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, finished]);

  useEffect(() => {
    if (!imageOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imageOpen]);

  const question = activeExam.questions[current];
  const currentSelection = answers[current] ?? [];
  const hasExtractedOptions = question.options.some(
    (option) => !option.includes("xem nguyên văn trong ảnh nguồn"),
  );
  const answered = answers.filter((answer) => answer.length > 0).length;
  const score = activeExam.questions.reduce(
    (total, item, index) =>
      total + (isSameSelection(answers[index] ?? [], item.answerIndexes) ? 1 : 0),
    0,
  );
  const isRevealed = finished || mode === "learn";

  const resultTopics = useMemo(() => {
    const result: Record<string, { total: number; correct: number }> = {};
    activeExam.questions.forEach((item, index) => {
      result[item.topic] ??= { total: 0, correct: 0 };
      result[item.topic].total += 1;
      if (isSameSelection(answers[index] ?? [], item.answerIndexes)) {
        result[item.topic].correct += 1;
      }
    });
    return Object.entries(result).toSorted(
      ([, left], [, right]) => left.correct / left.total - right.correct / right.total,
    );
  }, [activeExam, answers]);

  function begin(exam: SsgExam, nextMode: Mode) {
    setActiveExam(exam);
    setMode(nextMode);
    setCurrent(0);
    setAnswers(emptyAnswers(exam.questions.length));
    setFinished(false);
    setElapsed(0);
    setQuestionView("original");
    setScreen("quiz");
    window.scrollTo({ top: 0 });
  }

  function choose(index: number) {
    if (finished || mode === "learn") return;
    setAnswers((value) =>
      value.map((selection, position) => {
        if (position !== current) return selection;
        if (question.responseMode === "single") return [index];
        return selection.includes(index)
          ? selection.filter((selected) => selected !== index)
          : [...selection, index].toSorted((left, right) => left - right);
      }),
    );
  }

  function submit() {
    const unanswered = activeExam.questions.length - answered;
    if (
      mode === "test" &&
      unanswered > 0 &&
      !window.confirm(`Bạn còn ${unanswered} câu chưa chọn. Vẫn nộp bài?`)
    ) {
      return;
    }
    const nextStats = {
      ...stats,
      [activeExam.id]: {
        attempts: (stats[activeExam.id]?.attempts ?? 0) + 1,
        best: Math.max(stats[activeExam.id]?.best ?? 0, score),
      },
    };
    setStats(nextStats);
    window.localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
    setFinished(true);
    setScreen("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnHome() {
    setScreen("dashboard");
    setFinished(false);
    setImageOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "dashboard") {
    return (
      <main className="ssg-shell">
        <nav className="ssg-nav" aria-label="Điều hướng môn học">
          <a className="ssg-brand" href="#ssg-top">
            <span>S</span>
            <strong>SSG105 Practice Lab</strong>
          </a>
          <div className="ssg-tabs" role="navigation" aria-label="Chọn môn">
            <Link href="/">ADY201m</Link>
            <Link href="/mas202">MAS202</Link>
            <Link className="is-active" href="/ssg105" aria-current="page">SSG105</Link>
          </div>
        </nav>

        <section className="ssg-hero" id="ssg-top">
          <div>
            <p className="ssg-kicker">Google Slides archive · {SOURCE_SUMMARY.questionCount} câu</p>
            <h1>Đọc câu. Chọn đáp án. Hiểu vì sao.</h1>
            <p>
              Kho SSG được tách từ slide {SOURCE_SUMMARY.firstQuestionSlide}–{SOURCE_SUMMARY.lastQuestionSlide}.
              Câu hỏi và từng lựa chọn được OCR thành văn bản để làm bài, đồng thời luôn giữ ảnh gốc và lời giải từ ghi chú nguồn để đối chiếu.
            </p>
            <a href="#ssg-exams">Chọn bộ 50 câu <span aria-hidden="true">↓</span></a>
          </div>
          <aside aria-label="Tóm tắt nguồn SSG105">
            <span>Nguồn đã nhận diện</span>
            <strong>{SOURCE_SUMMARY.questionCount}</strong>
            <small>câu hỏi trong kho SSG</small>
            <dl>
              <div><dt>Bộ luyện</dt><dd>{EXAMS.length} × 50</dd></div>
              <div><dt>Đã kiểm chứng</dt><dd>{SOURCE_SUMMARY.verifiedQuestionCount}/{SOURCE_SUMMARY.questionCount}</dd></div>
              <div><dt>Ảnh nguồn</dt><dd>960 × 540</dd></div>
              <div><dt>Lưu điểm</dt><dd>Trên máy</dd></div>
            </dl>
          </aside>
        </section>

        <section className="ssg-section" id="ssg-exams">
          <header className="ssg-section-title">
            <div>
              <p className="ssg-kicker">01 / Làm bài</p>
              <h2>{EXAMS.length} bộ, mỗi bộ đúng 50 câu.</h2>
            </div>
            <p>
              Toàn bộ {SOURCE_SUMMARY.questionCount} câu nguồn được phân bổ vào các bộ luyện.
              {SOURCE_SUMMARY.practiceAssignmentCount > SOURCE_SUMMARY.questionCount
                ? ` ${SOURCE_SUMMARY.practiceAssignmentCount - SOURCE_SUMMARY.questionCount} lượt lặp được ghi rõ để mỗi bộ đủ 50 câu.`
                : " Không có câu lặp thêm trong các bộ luyện."}
            </p>
          </header>
          <div className="ssg-exam-grid">
            {EXAMS.map((exam, index) => (
              <article className="ssg-exam-card" key={exam.id} style={{ "--exam-accent": exam.accent } as React.CSSProperties}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><small>{exam.id}</small></div>
                <h3>{exam.label}</h3>
                <p>{exam.note}</p>
                <dl>
                  <div><dt>Kỷ lục</dt><dd>{stats[exam.id]?.best ?? 0}/{exam.questions.length}</dd></div>
                  <div><dt>Lượt làm</dt><dd>{stats[exam.id]?.attempts ?? 0}</dd></div>
                </dl>
                <div className="ssg-exam-actions">
                  <button type="button" onClick={() => begin(exam, "learn")}>Học có lời giải</button>
                  <button type="button" onClick={() => begin(exam, "test")}>Làm kiểm tra</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ssg-section ssg-frequency-section" id="ssg-frequency">
          <header className="ssg-section-title">
            <div>
              <p className="ssg-kicker">02 / Câu lặp</p>
              <h2>Câu nào được xếp lặp để đủ 50?</h2>
            </div>
            <p>Các câu dưới đây được xếp thêm để mọi bộ đều đủ 50 câu. Đây là tần suất trong bộ luyện, không phải tần suất đề thi thật.</p>
          </header>
          <div className="ssg-frequency-grid">
            {FREQUENT_QUESTIONS.map((item) => (
              <article key={item.id}>
                <span>Slide {item.sourceSlide}</span>
                <strong>{APPEARANCE_COUNT[item.id]} lượt</strong>
                <p>{item.questionVi || item.question}</p>
                <small>{item.topic}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="ssg-section ssg-study-section" id="ssg-study">
          <header className="ssg-section-title">
            <div>
              <p className="ssg-kicker">03 / Nên học gì</p>
              <h2>Ưu tiên theo mật độ chủ đề.</h2>
            </div>
            <p>Phân loại trên {SOURCE_SUMMARY.questionCount} câu nguồn duy nhất, không đếm lại các lượt luyện lặp; chủ đề có mật độ cao được xếp trước.</p>
          </header>
          <div className="ssg-topic-list">
            {TOPIC_STATS.map((item, index) => (
              <article key={item.topic}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.topic}</h3>
                  <p>{item.advice}</p>
                </div>
                <strong>{item.count} câu</strong>
                <i aria-hidden="true"><b style={{ width: `${(item.count / (TOPIC_STATS[0]?.count || 1)) * 100}%` }} /></i>
              </article>
            ))}
          </div>
        </section>

        <footer className="ssg-footer">
          <strong>SSG105 Practice Lab</strong>
          <span>Giữ nguyên nguồn slide · dữ liệu học lưu cục bộ</span>
        </footer>
      </main>
    );
  }

  if (screen === "results") {
    return (
      <main className="ssg-shell ssg-result-shell">
        <nav className="ssg-quiz-nav">
          <button type="button" onClick={returnHome}>S · SSG105</button>
          <span>{activeExam.label}</span>
        </nav>
        <section className="ssg-result-hero">
          <div><strong>{score}</strong><span>/{activeExam.questions.length}</span></div>
          <div>
            <p className="ssg-kicker">Kết quả · {Math.floor(elapsed / 60)} phút {elapsed % 60} giây</p>
            <h1>{scoreMessage(score)}</h1>
            <p>Bạn đúng {Math.round((score / activeExam.questions.length) * 100)}% và còn {activeExam.questions.length - score} câu cần xem lại theo ảnh gốc.</p>
            <div>
              <button type="button" onClick={() => begin(activeExam, mode)}>Làm lại bộ này</button>
              <button type="button" onClick={() => { setCurrent(0); setScreen("quiz"); }}>Xem lời giải từng câu</button>
              <button type="button" onClick={returnHome}>Về thư viện</button>
            </div>
          </div>
        </section>
        <section className="ssg-result-topics">
          <header><p className="ssg-kicker">Ưu tiên ôn lại</p><h2>Nhóm kiến thức yếu trước.</h2></header>
          {resultTopics.map(([topic, value]) => (
            <article key={topic}>
              <span>{topic}</span>
              <i><b style={{ width: `${(value.correct / value.total) * 100}%` }} /></i>
              <strong>{value.correct}/{value.total}</strong>
            </article>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell ssg-quiz-shell">
      <nav className="quiz-nav">
        <button className="mini-brand" type="button" onClick={returnHome}>
          <span>S</span>
          SSG Practice Lab
        </button>
        <div className="quiz-nav-meta">
          <span>{activeExam.label} · {mode === "learn" ? "Học có lời giải" : "Kiểm tra"}</span>
          <strong>{formatTime(elapsed)}</strong>
          <button type="button" onClick={returnHome}>Thoát</button>
        </div>
      </nav>
      <div className="quiz-progress" aria-hidden="true">
        <i style={{ width: `${((current + 1) / activeExam.questions.length) * 100}%` }} />
      </div>

      <section className="quiz-workspace">
        <aside className="question-map">
          <div>
            <p className="kicker">Bản đồ đề</p>
            <h2>{activeExam.id}</h2>
            <span>
              {mode === "learn"
                ? `${activeExam.questions.length} bài học · đáp án mở sẵn`
                : `${answered}/${activeExam.questions.length} đã trả lời`}
            </span>
          </div>
          <div className="number-grid" aria-label="Danh sách câu hỏi">
            {activeExam.questions.map((item, index) => (
              <button
                className={`${index === current ? "is-current" : ""} ${(answers[index]?.length ?? 0) > 0 ? "is-answered" : ""}`}
                type="button"
                key={`${item.id}-${index}`}
                onClick={() => setCurrent(index)}
                aria-label={`Câu ${index + 1}`}
                aria-current={index === current ? "step" : undefined}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="map-legend">
            {mode === "learn" ? (
              <span><i /> Chọn số câu để đọc lời giải</span>
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
              <span className="question-count">Câu {String(current + 1).padStart(2, "0")} / {activeExam.questions.length}</span>
              <span className="topic-chip">{question.topic}</span>
              {question.responseMode === "multiple" && (
                <span className="ssg-multi-chip">Chọn {question.answerIndexes.length} đáp án</span>
              )}
            </div>
            <button className="image-button" type="button" onClick={() => setImageOpen(true)}>
              <span aria-hidden="true">⌗</span>
              Xem ảnh gốc
            </button>
          </div>

          <section className={`question-copy ssg-quiz-question-copy ${question.question.length > 230 ? "is-dense" : ""}`} aria-labelledby="ssg-question-text">
            <div className="ssg-question-meta">
              <span>{question.subject} · Slide {question.sourceSlide}</span>
              <strong>
                {mode === "learn"
                  ? "Đáp án và lời giải đang mở"
                  : question.responseMode === "multiple"
                    ? `Phải chọn đúng đủ ${question.answerIndexes.length} đáp án`
                    : "Chọn một đáp án"}
                </strong>
            </div>
            {mode === "learn" && question.questionVi && question.questionVi !== question.question && (
              <div className="ssg-question-tabs" role="tablist" aria-label="Ngôn ngữ câu hỏi">
                <button
                  className={questionView === "original" ? "is-active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={questionView === "original"}
                  aria-controls="ssg-question-panel"
                  onClick={() => setQuestionView("original")}
                >
                  Câu hỏi gốc
                </button>
                <button
                  className={questionView === "translation" ? "is-active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={questionView === "translation"}
                  aria-controls="ssg-question-panel"
                  onClick={() => setQuestionView("translation")}
                >
                  Dịch câu hỏi &amp; đáp án
                </button>
              </div>
            )}
            <div
              className={`ssg-question-panel ${mode === "learn" && questionView === "translation" ? "is-translation" : ""}`}
              id="ssg-question-panel"
              role={mode === "learn" ? "tabpanel" : undefined}
            >
              <h1 id="ssg-question-text">
                {mode === "learn" && questionView === "translation"
                  ? question.questionVi || question.question
                  : question.question}
              </h1>
              {mode === "learn" && questionView === "translation" && (
                <span>Bản dịch tiếng Việt · Slide {question.sourceSlide}</span>
              )}
            </div>
          </section>

          <div
            className="option-list"
            role="group"
            aria-label={question.responseMode === "multiple" ? `Chọn đúng ${question.answerIndexes.length} đáp án` : "Chọn một đáp án"}
          >
            {question.options.map((option, index) => {
              const letter = LETTERS[index] ?? String(index + 1);
              const picked = currentSelection.includes(index);
              const isAnswer = question.answerIndexes.includes(index);
              const correct = isRevealed && isAnswer;
              const wrong = isRevealed && picked && !isAnswer;
              const displayedOption =
                mode === "learn" && questionView === "translation"
                  ? question.optionsVi[index] || option
                  : option;
              return (
                <button
                  className={`option-button ${picked ? "is-picked" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}`}
                  type="button"
                  key={`${letter}-${index}`}
                  onClick={() => choose(index)}
                  aria-pressed={picked}
                  disabled={mode === "learn" || finished}
                >
                  <span aria-hidden="true">{letter}</span>
                  <strong>{displayedOption}</strong>
                  <i aria-hidden="true">
                    {correct ? "✓" : wrong ? "×" : picked ? "●" : question.responseMode === "multiple" ? "□" : ""}
                  </i>
                </button>
              );
            })}
          </div>

          {question.image && (
            <details className="ssg-source-details" key={question.id} open={!hasExtractedOptions}>
              <summary>
                <span>Đối chiếu ảnh gốc</span>
                <small>Slide {question.sourceSlide} · 960 × 540</small>
              </summary>
              <figure className="ssg-source-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- source slide must remain pixel-identical */}
                <img src={question.image} alt={`Ảnh câu hỏi nguồn slide ${question.sourceSlide}`} />
                <figcaption>Ảnh gốc được giữ nguyên để kiểm chứng chéo nội dung OCR.</figcaption>
              </figure>
            </details>
          )}

          {isRevealed && (
            <section className="ssg-explanation">
              <header>
                <span>Đáp án trong ghi chú nguồn: {question.answerLetters.join(", ") || question.answerLetter || "chưa xác nhận"}</span>
                <strong>{question.correctAnswer || "Đối chiếu nội dung trên ảnh gốc"}</strong>
              </header>
              <div>
                <span>{mode === "learn" ? "Lời giải hiển thị ngay" : "Lời giải sau khi nộp bài"}</span>
                <h2>{question.questionVi || question.question}</h2>
                <p>{question.explanationVi}</p>
              </div>
              {question.verification.status === "semantic-conflict" ? (
                <small className="is-alert">
                  Cảnh báo kiểm chứng chéo: mã đáp án trong ghi chú nguồn có dấu hiệu mâu thuẫn với nội dung câu hỏi. Hệ thống giữ nguyên mã nguồn và ảnh slide để bạn đối chiếu.
                </small>
              ) : question.verification.status === "semantic-uncertain" ? (
                <small className="is-alert">
                  Cảnh báo kiểm chứng chéo: câu này còn nhiều cách hiểu hợp lý. Đáp án hiển thị là mã trong ghi chú nguồn.
                </small>
              ) : question.qualityFlags.length > 0 ? (
                <small>Ghi chú dữ liệu: {question.qualityFlags.join(", ")}</small>
              ) : null}
            </section>
          )}

          <footer className="question-controls">
            <button type="button" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}>← Câu trước</button>
            <span>{question.responseMode === "multiple" ? "Chấm đúng khi chọn đủ và không thừa" : "A–F để chọn · ← → để chuyển câu"}</span>
            {current < activeExam.questions.length - 1 ? (
              <button type="button" onClick={() => setCurrent((value) => value + 1)}>Câu tiếp →</button>
            ) : mode === "learn" ? (
              <button className="submit-button" type="button" onClick={returnHome}>Hoàn tất bài học</button>
            ) : (
              <button className="submit-button" type="button" onClick={submit}>Nộp bài ({answered}/{activeExam.questions.length})</button>
            )}
          </footer>
          {mode === "test" && !finished && current < activeExam.questions.length - 1 && <button className="early-submit" type="button" onClick={submit}>Nộp bài ngay</button>}
        </section>
      </section>

      {imageOpen && (
        <div className="ssg-image-modal" role="dialog" aria-modal="true" aria-label="Ảnh câu hỏi phóng to">
          <button type="button" aria-label="Đóng ảnh" onClick={() => setImageOpen(false)} />
          <figure>
            <button type="button" onClick={() => setImageOpen(false)} aria-label="Đóng">×</button>
            {/* eslint-disable-next-line @next/next/no-img-element -- source slide must remain pixel-identical */}
            <img src={question.image} alt={`Ảnh nguồn slide ${question.sourceSlide}`} />
          </figure>
        </div>
      )}
    </main>
  );
}
