"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MAS_EXAMS,
  masConceptTitle,
  type MasQuestion,
} from "../mas202-data";

const LETTERS = "ABCDEF";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function QuestionText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="mas-question-copy">
      {blocks.map((block, index) =>
        index === 0 ? (
          <h1 key={block}>{block}</h1>
        ) : (
          <pre key={block}>{block}</pre>
        ),
      )}
    </div>
  );
}

function ConceptLab({ question }: { question: MasQuestion }) {
  return (
    <section className="mas-concept-lab" aria-label="Phòng thí nghiệm khái niệm">
      <header>
        <div>
          <span>Khái niệm phải hiểu</span>
          <h2>{masConceptTitle(question.concept)}</h2>
        </div>
        <small>Không cần chọn đáp án để mở phần này</small>
      </header>

      <div className="mas-concept-grid">
        <article>
          <span>Khái niệm dùng khi nào?</span>
          <p>{question.application}</p>
        </article>
        <figure className={`mas-visual mas-visual-${question.visual.type}`}>
          <figcaption>{question.visual.title}</figcaption>
          <div>
            {question.visual.nodes.map((node, index) => (
              <div key={`${question.id}-visual-${index}`}>
                <small>{pad(index + 1)}</small>
                <strong>{node}</strong>
                {index < question.visual.nodes.length - 1 && (
                  <i aria-hidden="true">→</i>
                )}
              </div>
            ))}
          </div>
          <p>{question.visual.caption}</p>
        </figure>
      </div>
    </section>
  );
}

export default function Mas202Page() {
  const exam = MAS_EXAMS[0];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [imageOpen, setImageOpen] = useState(false);

  const question = exam.questions[current];
  const selected = answers[current];
  const answered = selected !== undefined;
  const correct = selected === question.answer;
  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () =>
      Object.entries(answers).filter(
        ([index, answer]) => exam.questions[Number(index)]?.answer === answer,
      ).length,
    [answers, exam.questions],
  );

  function chooseAnswer(index: number) {
    if (answered) return;
    setAnswers((value) => ({ ...value, [current]: index }));
  }

  function goTo(index: number) {
    setCurrent(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mas-shell">
      <nav className="mas-nav">
        <div className="mas-subject-tabs" role="navigation" aria-label="Chọn môn">
          <Link href="/">ADY201m</Link>
          <Link className="is-active" href="/mas202" aria-current="page">MAS202</Link>
          <Link href="/ssg105">SSG105</Link>
        </div>
        <div>
          <strong>MAS202 Concept Lab</strong>
          <span>1/4 đề đã khóa dữ liệu · 50/50 visualization</span>
        </div>
        <p>
          Đúng <strong>{score}</strong> / Đã làm {answeredCount}
        </p>
      </nav>

      <div className="mas-layout">
        <aside className="mas-map">
          <span>Đề đang học</span>
          <h2>{exam.id}</h2>
          <p>{exam.label}</p>
          <div aria-label="Bản đồ 50 câu">
            {exam.questions.map((item, index) => {
              const picked = answers[index];
              const state =
                picked === undefined
                  ? ""
                  : picked === item.answer
                    ? "is-correct"
                    : "is-wrong";
              return (
                <button
                  className={[
                    current === index ? "is-current" : "",
                    state,
                  ].join(" ")}
                  type="button"
                  key={item.id}
                  onClick={() => goTo(index)}
                  aria-label={`Câu ${item.number}`}
                  aria-current={current === index ? "step" : undefined}
                >
                  {item.number}
                </button>
              );
            })}
          </div>
          <footer>
            <span><i className="mas-dot-current" /> Đang xem</span>
            <span><i className="mas-dot-correct" /> Đúng</span>
            <span><i className="mas-dot-wrong" /> Cần ôn</span>
          </footer>
        </aside>

        <section className="mas-stage">
          <div className="mas-toolbar">
            <div>
              <span>CÂU {pad(question.number)} / 50</span>
              <strong>{masConceptTitle(question.concept)}</strong>
            </div>
            <button type="button" onClick={() => setImageOpen(true)}>
              Xem ảnh gốc 1920px
            </button>
          </div>

          <QuestionText text={question.question} />
          <ConceptLab question={question} />

          <section className="mas-options" aria-label="Các phương án">
            <header>
              <span>Kiểm tra hiểu biết</span>
              <p>Chọn một đáp án sau khi đã đọc khái niệm và sơ đồ.</p>
            </header>
            {question.options.map((option, index) => {
              const isSelected = selected === index;
              const isCorrect = answered && question.answer === index;
              const isWrong = answered && isSelected && !isCorrect;
              return (
                <button
                  className={[
                    isSelected ? "is-selected" : "",
                    isCorrect ? "is-correct" : "",
                    isWrong ? "is-wrong" : "",
                  ].join(" ")}
                  type="button"
                  key={`${question.id}-option-${index}`}
                  onClick={() => chooseAnswer(index)}
                  disabled={answered}
                >
                  <span>{LETTERS[index]}</span>
                  <strong>{option}</strong>
                  {isCorrect && <i>✓</i>}
                  {isWrong && <i>×</i>}
                </button>
              );
            })}
          </section>

          {answered && (
            <section
              className={`mas-result ${correct ? "is-correct" : "is-wrong"}`}
              aria-live="polite"
            >
              <span>{correct ? "Đã hiểu đúng" : "Cần xem lại cơ chế"}</span>
              <h2>
                Đáp án {LETTERS[question.answer]} · Không chỉ ghi nhớ đáp án
              </h2>
              <p>{question.explanation}</p>
            </section>
          )}

          <footer className="mas-controls">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
            >
              ← Câu trước
            </button>
            <span>{answeredCount}/50 câu đã làm</span>
            <button
              type="button"
              disabled={current === exam.questions.length - 1}
              onClick={() => goTo(current + 1)}
            >
              Câu tiếp →
            </button>
          </footer>
        </section>
      </div>

      {imageOpen && (
        <div
          className="mas-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh gốc câu ${question.number}`}
          onClick={() => setImageOpen(false)}
        >
          <button type="button" onClick={() => setImageOpen(false)}>
            Đóng ×
          </button>
          <img
            src={question.image}
            alt={`Ảnh gốc ${exam.id} câu ${question.number}`}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
