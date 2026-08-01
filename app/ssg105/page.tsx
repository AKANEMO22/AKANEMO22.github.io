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
type SavedStats = Record<string, { attempts: number; best: number }>;

const LETTERS = ["A", "B", "C", "D", "E"];
const STATS_KEY = "ssg105-exam-stats-v1";

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

export default function Ssg105Page() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [mode, setMode] = useState<Mode>("learn");
  const [activeExam, setActiveExam] = useState<SsgExam>(EXAMS[0]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(Array(50).fill(null));
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<SavedStats>(EMPTY_STATS);
  const [imageOpen, setImageOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

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
  const answered = answers.filter((answer) => answer !== null).length;
  const score = activeExam.questions.reduce(
    (total, item, index) => total + (answers[index] === item.answerIndex ? 1 : 0),
    0,
  );
  const isRevealed = finished || (mode === "learn" && answers[current] !== null);

  const resultTopics = useMemo(() => {
    const result: Record<string, { total: number; correct: number }> = {};
    activeExam.questions.forEach((item, index) => {
      result[item.topic] ??= { total: 0, correct: 0 };
      result[item.topic].total += 1;
      if (answers[index] === item.answerIndex) result[item.topic].correct += 1;
    });
    return Object.entries(result).toSorted(
      ([, left], [, right]) => left.correct / left.total - right.correct / right.total,
    );
  }, [activeExam, answers]);

  function begin(exam: SsgExam, nextMode: Mode) {
    setActiveExam(exam);
    setMode(nextMode);
    setCurrent(0);
    setAnswers(Array(exam.questions.length).fill(null));
    setFinished(false);
    setElapsed(0);
    setScreen("quiz");
    window.scrollTo({ top: 0 });
  }

  function choose(index: number) {
    if (finished || (mode === "learn" && answers[current] !== null)) return;
    setAnswers((value) => value.map((answer, position) => (position === current ? index : answer)));
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
        attempts: stats[activeExam.id].attempts + 1,
        best: Math.max(stats[activeExam.id].best, score),
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
            <p className="ssg-kicker">Google Slides archive · 130 câu</p>
            <h1>Đọc ảnh. Chọn đáp án. Hiểu vì sao.</h1>
            <p>
              Phần SSG105 được tách đúng từ slide {SOURCE_SUMMARY.firstQuestionSlide}–{SOURCE_SUMMARY.lastQuestionSlide}.
              Mỗi lượt có đúng 50 câu, giữ mã đáp án và lời giải từ ghi chú nguồn, sau đó đối chiếu lại với ảnh gốc và hai lượt OCR.
            </p>
            <a href="#ssg-exams">Chọn bộ 50 câu <span aria-hidden="true">↓</span></a>
          </div>
          <aside aria-label="Tóm tắt nguồn SSG105">
            <span>Nguồn đã nhận diện</span>
            <strong>{SOURCE_SUMMARY.questionCount}</strong>
            <small>câu SSG105</small>
            <dl>
              <div><dt>Bộ luyện</dt><dd>3 × 50</dd></div>
              <div><dt>Đã kiểm chứng</dt><dd>{SOURCE_SUMMARY.verifiedQuestionCount}/130</dd></div>
              <div><dt>Ảnh nguồn</dt><dd>960 × 540</dd></div>
              <div><dt>Lưu điểm</dt><dd>Trên máy</dd></div>
            </dl>
          </aside>
        </section>

        <section className="ssg-section" id="ssg-exams">
          <header className="ssg-section-title">
            <div>
              <p className="ssg-kicker">01 / Làm bài</p>
              <h2>Ba lượt, mỗi lượt đúng 50 câu.</h2>
            </div>
            <p>Bộ 03 lặp có chủ đích 20 câu trọng tâm để phủ đủ 130 câu nguồn mà vẫn giữ cấu trúc 50 câu/lượt.</p>
          </header>
          <div className="ssg-exam-grid">
            {EXAMS.map((exam, index) => (
              <article className="ssg-exam-card" key={exam.id} style={{ "--exam-accent": exam.accent } as React.CSSProperties}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><small>{exam.id}</small></div>
                <h3>{exam.label}</h3>
                <p>{exam.note}</p>
                <dl>
                  <div><dt>Kỷ lục</dt><dd>{stats[exam.id].best}/50</dd></div>
                  <div><dt>Lượt làm</dt><dd>{stats[exam.id].attempts}</dd></div>
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
            <p>Mỗi câu chỉ xuất hiện một lần trong nguồn. Hai mươi câu dưới đây được xếp thêm vào Bộ 03 để ba lượt đều đủ 50 câu; đây không phải tần suất đề thi thật.</p>
          </header>
          <div className="ssg-frequency-grid">
            {FREQUENT_QUESTIONS.map((item) => (
              <article key={item.id}>
                <span>Slide {item.sourceSlide}</span>
                <strong>{APPEARANCE_COUNT[item.id]} lượt</strong>
                <p>{item.questionVi}</p>
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
            <p>Phân loại trên 130 câu nguồn duy nhất, không đếm lại 20 câu được lặp trong Bộ 03; chủ đề có mật độ cao được xếp trước.</p>
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
                <i aria-hidden="true"><b style={{ width: `${(item.count / TOPIC_STATS[0].count) * 100}%` }} /></i>
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
    <main className="ssg-shell ssg-quiz-shell">
      <nav className="ssg-quiz-nav">
        <button type="button" onClick={returnHome}>S · SSG105</button>
        <span>{activeExam.label} · {mode === "learn" ? "Học" : "Kiểm tra"}</span>
        <strong>{answered}/{activeExam.questions.length}</strong>
      </nav>
      <div className="ssg-progress"><i style={{ width: `${((current + 1) / activeExam.questions.length) * 100}%` }} /></div>

      <section className="ssg-quiz-workspace">
        <aside className="ssg-question-map">
          <p className="ssg-kicker">Bản đồ {activeExam.questions.length} câu</p>
          <div>
            {activeExam.questions.map((item, index) => (
              <button
                className={`${index === current ? "is-current" : ""} ${answers[index] !== null ? "is-answered" : ""}`}
                type="button"
                key={`${item.id}-${index}`}
                onClick={() => setCurrent(index)}
                aria-label={`Câu ${index + 1}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </aside>

        <section className="ssg-question-stage">
          <header>
            <div><span>Câu {String(current + 1).padStart(2, "0")} / {activeExam.questions.length}</span><strong>{question.topic}</strong></div>
            <button type="button" onClick={() => setImageOpen(true)}>Phóng to ảnh</button>
          </header>
          <figure className="ssg-source-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- source slide must remain pixel-identical */}
            <img src={question.image} alt={`Ảnh câu hỏi nguồn slide ${question.sourceSlide}`} />
            <figcaption>Slide nguồn {question.sourceSlide} · ảnh 960 × 540</figcaption>
          </figure>

          <div className="ssg-answer-grid" role="group" aria-label="Chọn đáp án">
            {LETTERS.slice(0, question.optionCount).map((letter, index) => {
              const picked = answers[current] === index;
              const correct = isRevealed && index === question.answerIndex;
              const wrong = isRevealed && picked && index !== question.answerIndex;
              return (
                <button
                  className={`${picked ? "is-picked" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}`}
                  type="button"
                  key={letter}
                  onClick={() => choose(index)}
                  aria-pressed={picked}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {isRevealed && (
            <section className="ssg-explanation">
              <header>
                <span>Đáp án {question.answerLetter}</span>
                <strong>{question.correctAnswer || "Đối chiếu nội dung trên ảnh gốc"}</strong>
              </header>
              <div>
                <span>Câu hỏi / bản dịch</span>
                <h2>{question.questionVi}</h2>
                <p>{question.explanationVi}</p>
              </div>
              {question.qualityFlags.length > 0 && (
                <small>Ghi chú nguồn cần đối chiếu thêm: {question.qualityFlags.join(", ")}</small>
              )}
            </section>
          )}

          <footer className="ssg-question-controls">
            <button type="button" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}>← Câu trước</button>
            {current < activeExam.questions.length - 1 ? (
              <button type="button" onClick={() => setCurrent((value) => value + 1)}>Câu tiếp →</button>
            ) : (
              <button className="is-submit" type="button" onClick={submit}>Nộp bài ({answered}/{activeExam.questions.length})</button>
            )}
          </footer>
          {mode === "test" && !finished && current < activeExam.questions.length - 1 && <button className="ssg-early-submit" type="button" onClick={submit}>Nộp bài ngay</button>}
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
