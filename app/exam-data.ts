import fa24 from "../data/exams/FA24-RE.json";
import fa25 from "../data/exams/FA25-FE.json";
import sp26 from "../data/exams/SP26-FE.json";
import su25 from "../data/exams/SU25-FE.json";

export type ExamId = "SP26-FE" | "FA25-FE" | "SU25-FE" | "FA24-RE";

export type ExamQuestion = {
  id: string;
  exam: ExamId;
  number: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  image: string;
  verified: boolean;
};

export type Exam = {
  id: ExamId;
  label: string;
  term: string;
  date: string;
  campus: string;
  type: "FE" | "RE";
  accent: string;
  questions: ExamQuestion[];
};

export const EXAMS: Exam[] = [
  {
    id: "SP26-FE",
    label: "Spring 2026",
    term: "SP26",
    date: "18.04.2026",
    campus: "Hà Nội",
    type: "FE",
    accent: "#b8ef68",
    questions: sp26 as ExamQuestion[],
  },
  {
    id: "FA25-FE",
    label: "Fall 2025",
    term: "FA25",
    date: "18.11.2025",
    campus: "Hà Nội",
    type: "FE",
    accent: "#ff896b",
    questions: fa25 as ExamQuestion[],
  },
  {
    id: "SU25-FE",
    label: "Summer 2025",
    term: "SU25",
    date: "31.07.2025",
    campus: "Hà Nội",
    type: "FE",
    accent: "#6bd7e5",
    questions: su25 as ExamQuestion[],
  },
  {
    id: "FA24-RE",
    label: "Fall 2024 · Retake",
    term: "FA24",
    date: "20.11.2024",
    campus: "Hà Nội",
    type: "RE",
    accent: "#d8b4fe",
    questions: fa24 as ExamQuestion[],
  },
];

export const ROADMAP = [
  {
    day: "Ngày 01",
    title: "Chẩn đoán",
    note: "Làm SP26 ở chế độ kiểm tra. Không tra cứu, đánh dấu nhóm câu sai.",
    target: "50 câu · 60 phút",
  },
  {
    day: "Ngày 02",
    title: "Metrics & Evaluation",
    note: "Ôn confusion matrix, precision, recall, F1, ROC–AUC và cross-validation.",
    target: "90 phút",
  },
  {
    day: "Ngày 03",
    title: "Thuật toán cốt lõi",
    note: "So sánh linear/logistic regression, KNN, SVM, cây quyết định và ensemble.",
    target: "90 phút",
  },
  {
    day: "Ngày 04",
    title: "Dữ liệu & Pipeline",
    note: "Ôn tiền xử lý, encoding, scaling, mất cân bằng lớp và data leakage.",
    target: "75 phút",
  },
  {
    day: "Ngày 05",
    title: "Đề chéo",
    note: "Làm FA25 và SU25. Sau mỗi đề, chỉ xem lại các câu sai.",
    target: "2 × 50 câu",
  },
  {
    day: "Ngày 06",
    title: "Vá lỗ hổng",
    note: "Làm lại toàn bộ câu sai, đọc giải thích và đối chiếu ảnh gốc.",
    target: "≥ 85% chính xác",
  },
  {
    day: "Ngày 07",
    title: "Mô phỏng cuối",
    note: "Làm FA24-RE như thi thật. Dừng ôn khi đạt 43/50 hai lượt liên tiếp.",
    target: "50 câu · 60 phút",
  },
];
