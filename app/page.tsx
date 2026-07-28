"use client";

import { useEffect, useMemo, useState } from "react";
import { QUESTION_BANK, type Question } from "./questions";

type QuizQuestion = Question;

const QUIZ_SIZE = 50;
const LETTERS = ["A", "B", "C", "D"];

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function createQuiz(seed: number): QuizQuestion[] {
  const random = seededRandom(seed);
  return shuffled(QUESTION_BANK, random)
    .slice(0, QUIZ_SIZE)
    .map((question) => {
      const mixedOptions = shuffled(
        question.options.map((option, originalIndex) => ({ option, originalIndex })),
        random,
      );

      return {
        ...question,
        options: mixedOptions.map(({ option }) => option) as Question["options"],
        answer: mixedOptions.findIndex(
          ({ originalIndex }) => originalIndex === question.answer,
        ),
      };
    });
}

function scoreMessage(percentage: number) {
  if (percentage >= 90) return "Rất chắc bài!";
  if (percentage >= 75) return "Tiến bộ rất tốt";
  if (percentage >= 60) return "Đã nắm phần nền";
  return "Làm thêm một lượt nhé";
}

export default function Home() {
  const [quiz, setQuiz] = useState(() => createQuiz(303));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<(number | null)[]>(
    () => Array(QUIZ_SIZE).fill(null),
  );
  const [finished, setFinished] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  const current = quiz[currentIndex];
  const selected = responses[currentIndex];
  const answered = selected !== null;
  const liveScore = responses.reduce(
    (score, response, index) =>
      score + (response !== null && response === quiz[index]?.answer ? 1 : 0),
    0,
  );
  const percentage = Math.round((liveScore / QUIZ_SIZE) * 100);
  const progress = finished ? 100 : ((currentIndex + 1) / QUIZ_SIZE) * 100;

  const topicResults = useMemo(() => {
    const result = new Map<string, { correct: number; total: number }>();
    quiz.forEach((question, index) => {
      const currentResult = result.get(question.topic) ?? { correct: 0, total: 0 };
      currentResult.total += 1;
      if (responses[index] === question.answer) currentResult.correct += 1;
      result.set(question.topic, currentResult);
    });
    return Array.from(result.entries());
  }, [quiz, responses]);

  const incorrectQuestions = useMemo(
    () =>
      quiz
        .map((question, index) => ({
          question,
          response: responses[index],
          number: index + 1,
        }))
        .filter(({ question, response }) => response !== question.answer),
    [quiz, responses],
  );

  useEffect(() => {
    const savedBest = Number(window.localStorage.getItem("ail303-best-score") ?? 0);
    if (Number.isFinite(savedBest)) setBestScore(savedBest);
  }, []);

  function chooseAnswer(optionIndex: number) {
    if (answered || finished) return;
    setResponses((previous) => {
      const updated = [...previous];
      updated[currentIndex] = optionIndex;
      return updated;
    });
  }

  function goNext() {
    if (!answered) return;
    if (currentIndex < QUIZ_SIZE - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    setFinished(true);
    const finalScore = liveScore;
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      window.localStorage.setItem("ail303-best-score", String(finalScore));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewQuiz() {
    setQuiz(createQuiz(Date.now()));
    setResponses(Array(QUIZ_SIZE).fill(null));
    setCurrentIndex(0);
    setFinished(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (finished) return;
      const key = event.key.toUpperCase();
      const answerIndex = LETTERS.indexOf(key);
      if (answerIndex >= 0 && !answered) {
        chooseAnswer(answerIndex);
      }
      if (event.key === "Enter" && answered) {
        goNext();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="Về đầu trang">
          <span className="brand-mark">A</span>
          <span>
            <strong>AIL303m</strong>
            <small>phòng luyện nhanh</small>
          </span>
        </a>

        <div className="topbar-meta" aria-label="Thông tin lượt làm">
          <span>90 câu trong ngân hàng</span>
          <span className="status-dot">50 câu / lượt</span>
        </div>
      </header>

      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {!finished ? (
        <section className="quiz-layout" id="main-content">
          <aside className="intro-panel">
            <p className="eyebrow">Ôn dễ · nhớ lâu</p>
            <h1>Học từng câu, hiểu từng đáp án.</h1>
            <p className="intro-copy">
              Một lượt gồm đúng 50 câu nền tảng AI & Machine Learning. Chọn đáp
              án để xem giải thích ngay.
            </p>

            <div className="stat-grid">
              <div>
                <span>Câu hiện tại</span>
                <strong>{String(currentIndex + 1).padStart(2, "0")}/50</strong>
              </div>
              <div>
                <span>Đang đúng</span>
                <strong>{String(liveScore).padStart(2, "0")}</strong>
              </div>
              <div>
                <span>Kỷ lục</span>
                <strong>{String(bestScore).padStart(2, "0")}/50</strong>
              </div>
            </div>

            <div className="shortcut-card">
              <span>Phím tắt</span>
              <p>
                <kbd>A</kbd>–<kbd>D</kbd> chọn đáp án
              </p>
              <p>
                <kbd>Enter</kbd> sang câu tiếp
              </p>
            </div>
          </aside>

          <section className="question-card" aria-live="polite">
            <div className="question-meta">
              <span className="topic-pill">{current.topic}</span>
              <span>Câu {currentIndex + 1} trên 50</span>
            </div>

            <h2>{current.question}</h2>

            <div className="answer-list" role="group" aria-label="Các đáp án">
              {current.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === current.answer;
                const isSelected = optionIndex === selected;
                let stateClass = "";
                if (answered && isCorrect) stateClass = " is-correct";
                if (answered && isSelected && !isCorrect) stateClass = " is-wrong";

                return (
                  <button
                    className={`answer-option${stateClass}`}
                    type="button"
                    key={option}
                    onClick={() => chooseAnswer(optionIndex)}
                    disabled={answered}
                    aria-pressed={isSelected}
                  >
                    <span className="answer-letter">{LETTERS[optionIndex]}</span>
                    <span>{option}</span>
                    {answered && isCorrect && (
                      <span className="answer-icon" aria-label="Đáp án đúng">
                        ✓
                      </span>
                    )}
                    {answered && isSelected && !isCorrect && (
                      <span className="answer-icon" aria-label="Đáp án sai">
                        ×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className={`explanation${answered ? " is-visible" : ""}`}>
              {answered ? (
                <>
                  <div className="explanation-copy">
                    <span className={selected === current.answer ? "good" : "retry"}>
                      {selected === current.answer ? "Chính xác" : "Chưa đúng"}
                    </span>
                    <p>{current.explanation}</p>
                  </div>
                  <button className="next-button" type="button" onClick={goNext}>
                    {currentIndex === QUIZ_SIZE - 1 ? "Xem kết quả" : "Câu tiếp theo"}
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : (
                <p>Chọn một đáp án để xem giải thích.</p>
              )}
            </div>
          </section>
        </section>
      ) : (
        <section className="results-layout" id="main-content">
          <div className="result-hero">
            <p className="eyebrow">Hoàn thành lượt 50 câu</p>
            <div className="score-ring" aria-label={`Điểm ${liveScore} trên 50`}>
              <strong>{liveScore}</strong>
              <span>/ 50</span>
            </div>
            <h1>{scoreMessage(percentage)}</h1>
            <p>
              Bạn đạt <strong>{percentage}%</strong>. Xem lại phần còn yếu rồi
              bắt đầu một lượt 50 câu mới.
            </p>
            <button className="restart-button" type="button" onClick={startNewQuiz}>
              Làm lượt mới
              <span aria-hidden="true">↻</span>
            </button>
          </div>

          <div className="result-details">
            <div className="result-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Theo chủ đề</p>
                  <h2>Bản đồ kết quả</h2>
                </div>
                <span>{bestScore}/50 kỷ lục</span>
              </div>
              <div className="topic-results">
                {topicResults.map(([topic, result]) => (
                  <div className="topic-row" key={topic}>
                    <span>{topic}</span>
                    <div className="mini-track" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.round((result.correct / result.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {result.correct}/{result.total}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="result-card review-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Ôn lại</p>
                  <h2>
                    {incorrectQuestions.length === 0
                      ? "Không có câu sai"
                      : `${incorrectQuestions.length} câu cần xem lại`}
                  </h2>
                </div>
              </div>

              {incorrectQuestions.length === 0 ? (
                <p className="perfect-note">
                  Tuyệt vời — bạn đã trả lời đúng toàn bộ lượt này.
                </p>
              ) : (
                <div className="review-list">
                  {incorrectQuestions.map(({ question, response, number }) => (
                    <article key={question.id}>
                      <span>Câu {number}</span>
                      <h3>{question.question}</h3>
                      <p>
                        Đáp án đúng: <strong>{question.options[question.answer]}</strong>
                      </p>
                      {response !== null && (
                        <small>Bạn chọn: {question.options[response]}</small>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer>
        <p>AIL303m · luyện nền tảng mỗi ngày</p>
        <span>Nội dung dễ · giải thích tức thì · không giới hạn lượt</span>
      </footer>
    </main>
  );
}
