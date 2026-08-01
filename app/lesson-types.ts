export type LessonOptionAnalysis = {
  letter: string;
  verdict: "correct" | "incorrect";
  explanation: string;
};

export type LessonVisual = {
  type: "flow" | "comparison" | "formula" | "matrix" | "pipeline";
  title: string;
  items: string[];
  caption: string;
};

export type QuestionLesson = {
  id: string;
  visualLearning: {
    takeaway: string;
    rule: string;
    flow: Array<{
      label: string;
      note: string;
      kind: "input" | "process" | "result" | "warning";
    }>;
    optionCues: string[];
    memoryHook: string;
  };
  translation: {
    question: string;
    options: string[];
  };
  concept: {
    title: string;
    summary: string;
  };
  whyCorrect: string;
  optionAnalysis: LessonOptionAnalysis[];
  example: {
    title: string;
    scenario: string;
    takeaway: string;
  };
  visual: LessonVisual;
  deepDive: {
    mechanism: string;
    reasoningSteps: string[];
    commonMistake: string;
    examTip: string;
  };
};
