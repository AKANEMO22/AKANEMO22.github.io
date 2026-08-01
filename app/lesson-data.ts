import fa24Lessons from "../data/lessons/FA24-RE.json";
import fa25Lessons from "../data/lessons/FA25-FE.json";
import sp26Lessons from "../data/lessons/SP26-FE.json";
import su25Lessons from "../data/lessons/SU25-FE.json";
import type { ExamId } from "./exam-data";
import type { QuestionLesson } from "./lesson-types";

const lessonLists: Record<ExamId, QuestionLesson[]> = {
  "SP26-FE": sp26Lessons as QuestionLesson[],
  "FA25-FE": fa25Lessons as QuestionLesson[],
  "SU25-FE": su25Lessons as QuestionLesson[],
  "FA24-RE": fa24Lessons as QuestionLesson[],
};

export const LESSONS = Object.fromEntries(
  Object.entries(lessonLists).map(([examId, lessons]) => [
    examId,
    Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson])),
  ]),
) as Record<ExamId, Record<string, QuestionLesson>>;

export function getLesson(examId: ExamId, questionId: string) {
  const lesson = LESSONS[examId][questionId];
  if (!lesson) {
    throw new Error(`Missing lesson for ${questionId}`);
  }
  return lesson;
}
