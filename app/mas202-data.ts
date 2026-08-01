import b5fe from "../data/mas202/exams/SP26-B5FE.json";

export type MasVisualType =
  | "balance"
  | "bars"
  | "boxplot"
  | "cause-effect"
  | "checklist"
  | "comparison"
  | "decision"
  | "distribution"
  | "equivalence"
  | "flow"
  | "formula"
  | "gauge"
  | "grid"
  | "interval"
  | "line"
  | "mapping"
  | "matrix"
  | "normal-curve"
  | "number-line"
  | "pairs"
  | "quadrants"
  | "ratio"
  | "residuals"
  | "scatter"
  | "set"
  | "slots"
  | "stack"
  | "substitution"
  | "t-curve"
  | "threshold"
  | "timeline"
  | "transform"
  | "tree"
  | "venn"
  | "weighted-average";

export type MasQuestion = {
  id: string;
  exam: string;
  number: number;
  question: string;
  options: string[];
  answer: number;
  concept: string;
  application: string;
  explanation: string;
  visual: {
    type: MasVisualType;
    title: string;
    nodes: string[];
    caption: string;
  };
  image: string;
  verified: boolean;
};

export type MasExam = {
  id: string;
  label: string;
  date: string;
  type: "FE" | "RE";
  questions: MasQuestion[];
};

export const MAS_EXAMS: MasExam[] = [
  {
    id: "SP26-B5FE",
    label: "Spring 2026 · B5 Final Exam",
    date: "25.04.2026",
    type: "FE",
    questions: b5fe as MasQuestion[],
  },
];

export const MAS_CONCEPT_TITLES: Record<string, string> = {
  "continuous-variable": "Biến định lượng liên tục",
  "population-and-sample": "Tổng thể và mẫu",
  "designed-experiment": "Thí nghiệm có thiết kế",
  "measurement-error": "Sai số đo lường và đạo đức khảo sát",
  "contingency-table": "Bảng chéo hai biến phân loại",
  "frequency-distribution": "Phân phối tần số",
  "weighted-frequency-total": "Tổng có trọng số từ tần số",
  "scatterplot-direction": "Hướng liên hệ trên scatterplot",
  "honest-axis-scale": "Tỷ lệ trục trung thực",
  median: "Trung vị",
  range: "Khoảng biến thiên",
  "sample-variance": "Phương sai mẫu",
  quartiles: "Tứ phân vị",
  "population-variance": "Phương sai tổng thể",
  covariance: "Hiệp phương sai",
  "probability-union": "Quy tắc cộng xác suất",
  "conditional-probability": "Xác suất có điều kiện",
  "counting-rule": "Quy tắc đếm",
  "expected-value": "Giá trị kỳ vọng",
  "binomial-complement": "Nhị thức và biến cố bù",
  "poisson-distribution": "Phân phối Poisson",
  "portfolio-mean": "Kỳ vọng danh mục",
  "normal-symmetry": "Tính đối xứng của chuẩn tắc",
  "normal-quantile": "Phân vị chuẩn",
  "linear-transformation": "Biến đổi tuyến tính",
  "sampling-distribution-mean": "Phân phối lấy mẫu của trung bình",
  "sampling-distribution-proportion": "Phân phối lấy mẫu của tỷ lệ",
  "confidence-critical-value": "Giá trị tới hạn của khoảng tin cậy",
  "proportion-confidence-interval": "Khoảng tin cậy cho tỷ lệ",
  "sample-size-mean": "Cỡ mẫu để ước lượng trung bình",
  "hypothesis-formulation": "Thiết lập giả thuyết",
  "two-sided-rejection-region": "Miền bác bỏ hai phía",
  "one-sample-t-critical": "Giá trị tới hạn t một mẫu",
  "one-proportion-z-test": "Kiểm định z cho một tỷ lệ",
  "p-value-decision": "Ra quyết định bằng p-value",
  "independent-t-assumptions": "Giả định của kiểm định t độc lập",
  "paired-t-test": "Kiểm định t ghép cặp",
  "paired-mean-hypothesis": "Giả thuyết cho hiệu ghép cặp",
  "two-proportion-z-test": "Kiểm định z hai tỷ lệ",
  "f-test-variances": "Kiểm định F hai phương sai",
  "one-way-anova": "ANOVA một nhân tố",
  "two-way-anova-df": "Bậc tự do ANOVA hai nhân tố",
  "regression-slope": "Hệ số góc hồi quy",
  "regression-prediction": "Dự báo bằng phương trình hồi quy",
  "regression-sse": "Tổng bình phương sai số",
  "regression-assumptions": "Các giả định hồi quy",
  "correlation-test": "Kiểm định hệ số tương quan",
  "multiple-regression-equation": "Phương trình hồi quy bội",
  "adjusted-r-squared": "R² hiệu chỉnh",
};

export function masConceptTitle(concept: string) {
  return MAS_CONCEPT_TITLES[concept] ?? concept.replaceAll("-", " ");
}

