import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  evaluateQuestion,
  questionsForSkill,
} from "../../utils/gaiaContent";
import CourseQuizQuestion from "./CourseQuizQuestion";
import {
  emptyAnswer,
  toggleQuizOption,
  updateQuizAnswer,
} from "./quizAnswer";

/**
 * Practice quiz. One question at a time; answers are graded locally against
 * the course's `correct` indexes, open questions reveal the sample answer.
 * Nothing is stored — a reload starts a fresh run.
 */
export default function CourseQuiz({ course, initialSkill = "" }) {
  const { t } = useTranslation();
  const [skillFilter, setSkillFilter] = useState(initialSkill);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    setSkillFilter(initialSkill);
    setIndex(0);
  }, [initialSkill]);

  const questions = useMemo(
    () => questionsForSkill(course.questions, skillFilter),
    [course.questions, skillFilter],
  );

  const safeIndex = questions.length === 0 ? 0 : Math.min(index, questions.length - 1);
  const question = questions[safeIndex];
  const answer = (question && answers[question.id]) || emptyAnswer();
  const graded = question ? evaluateQuestion(question, answer.selection) : null;

  const updateAnswer = (patch) => {
    if (!question) return;
    setAnswers((previous) => ({
      ...previous,
      [question.id]: updateQuizAnswer(previous[question.id], patch),
    }));
  };

  const selectSkill = (value) => {
    setSkillFilter(value);
    setIndex(0);
  };

  const toggleOption = (optionIndex) => {
    if (!question) return;
    updateAnswer({
      selection: toggleQuizOption(question, answer, optionIndex).selection,
    });
  };

  const skills = useMemo(
    () =>
      (course.skillsDoc?.skills || [])
        .map((skill) => ({
          key: skill.key,
          name: skill.name,
          count: questionsForSkill(course.questions, skill.key).length,
        }))
        .filter((skill) => skill.count > 0),
    [course.skillsDoc, course.questions],
  );

  if (course.questions.length === 0) {
    return (
      <p data-guide="course-quiz" className="text-sm text-base-content/70">
        {t("course.quiz.empty")}
      </p>
    );
  }

  return (
    <div data-guide="course-quiz" className="flex flex-col gap-4">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base-content/70">
          {t("course.quiz.filter_label")}
        </span>
        <select
          className="select select-sm"
          value={skillFilter}
          onChange={(event) => selectSkill(event.target.value)}
        >
          <option value="">{t("course.quiz.all_skills")}</option>
          {skills.map((skill) => (
            <option key={skill.key} value={skill.key}>
              {skill.name}
            </option>
          ))}
        </select>
      </label>

      {!question ? (
        <p className="text-sm text-base-content/70">{t("course.quiz.empty")}</p>
      ) : (
        <CourseQuizQuestion
          question={question}
          answer={answer}
          graded={graded}
          onToggleOption={toggleOption}
          onChange={updateAnswer}
          progress={t("course.quiz.progress", {
            current: safeIndex + 1,
            total: questions.length,
          })}
          footer={
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                disabled={safeIndex <= 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                {t("course.quiz.previous")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1"
                disabled={safeIndex >= questions.length - 1}
                onClick={() =>
                  setIndex((value) => Math.min(questions.length - 1, value + 1))
                }
              >
                {t("course.quiz.next")}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}
