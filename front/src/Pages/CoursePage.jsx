import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { Bot, GraduationCap, RotateCcw } from "lucide-react";

import InfoLayout from "../components/Others/InfoLayout";
import CourseLernseiten from "../components/Course/CourseLernseiten";
import CourseQuiz from "../components/Course/CourseQuiz";
import CourseReview from "../components/Course/CourseReview";
import CourseSkills from "../components/Course/CourseSkills";
import { useImportConversation } from "../hooks/useImportConversation";
import { useToast } from "../hooks/useToast";
import { loadCourse } from "../utils/courseCatalog";

const LEARN_TABS = [
  { id: "skills", labelKey: "course.tab_skills", guide: "course-tab-skills" },
  { id: "quiz", labelKey: "course.tab_quiz", guide: "course-tab-quiz" },
  {
    id: "lernseiten",
    labelKey: "course.tab_lernseiten",
    guide: "course-tab-lernseiten",
  },
];

const REVIEW_TABS = [
  {
    id: "skills",
    labelKey: "course.tab_skills_review",
    guide: "course-tab-skills-review",
  },
  { id: "quiz", labelKey: "course.tab_quiz_review", guide: "course-tab-quiz-review" },
];

function Stats({ stats }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      <li className="badge badge-ghost badge-sm">
        {t("course.stat_topics", { n: stats.topics })}
      </li>
      <li className="badge badge-ghost badge-sm">
        {t("course.stat_skills", { n: stats.skills })}
      </li>
      <li className="badge badge-ghost badge-sm">
        {t("course.stat_questions", { n: stats.questions })}
      </li>
      <li className="badge badge-ghost badge-sm">
        {t("course.stat_lernseiten", { n: stats.lernseiten })}
      </li>
    </ul>
  );
}

/**
 * `/course/:courseId` — the course view behind a course persona.
 *
 * Learn mode holds the skills browser, the practice quiz and the
 * self-learning pages. Review mode embeds the course's own lecturer pages and
 * repeats the coverage numbers, so missing explanations and draft questions
 * stay visible instead of being hidden by the practice view.
 *
 * The page loads the persona and its JSON datasets once; the much larger
 * review/self-learning HTML is fetched when its tab (or a page) opens.
 */
export default function CoursePage() {
  const { courseId } = useParams();
  const { t } = useTranslation();
  const importConversation = useImportConversation();
  const { notifyError } = useToast();

  const [status, setStatus] = useState("loading");
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState("learn");
  const [learnTab, setLearnTab] = useState("skills");
  const [reviewTab, setReviewTab] = useState("skills");
  const [quizSkill, setQuizSkill] = useState("");
  const [lernseiteUrl, setLernseiteUrl] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    loadCourse(courseId, { force: reloadKey > 0 })
      .then((loaded) => {
        if (cancelled) return;
        setCourse(loaded);
        setStatus("ready");
      })
      .catch((reason) => {
        if (cancelled) return;
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStatus(message === "NOT_A_COURSE" ? "not-a-course" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, reloadKey]);

  const tabs = mode === "review" ? REVIEW_TABS : LEARN_TABS;
  const activeTab = mode === "review" ? reviewTab : learnTab;

  const startChat = async (prompt) => {
    if (!course || starting) return;
    setStarting(true);
    try {
      const persona = prompt
        ? {
            ...course.persona,
            messages: [
              ...(course.persona?.messages || []),
              { role: "user", content: prompt },
            ],
          }
        : course.persona;
      await importConversation(persona, false, null, {
        persona: {
          title: course.title,
          description: course.subtitle,
          category: course.entry?.category || "",
          path: course.personaPath,
          courseId: course.id,
        },
      });
    } catch (reason) {
      console.error("Failed to start course chat", reason);
      notifyError(t("course.chat_error"));
      setStarting(false);
    }
  };

  const title = status === "ready" ? course.title : t("course.title");
  const subtitle = status === "ready" ? course.subtitle : "";

  if (status === "loading") {
    return (
      <InfoLayout
        title={title}
        subtitle={subtitle}
        maxWidthClass="max-w-6xl"
      >
        <div className="flex items-center gap-3 py-10">
          <span className="loading loading-spinner loading-md" />
          <span className="text-sm text-base-content/70">
            {t("course.loading")}
          </span>
        </div>
      </InfoLayout>
    );
  }

  if (status === "error" || status === "not-a-course") {
    return (
      <InfoLayout title={title} maxWidthClass="max-w-2xl">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-error" role="alert">
            {status === "not-a-course"
              ? t("course.not_a_course")
              : t("course.load_error")}
          </p>
          {status === "error" && (
            <p className="break-all text-xs text-base-content/60">
              {t("course.load_error_detail")}
              {error ? ` (${error})` : ""}
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("course.retry")}
          </button>
        </div>
      </InfoLayout>
    );
  }

  return (
    <InfoLayout
      title={title}
      subtitle={subtitle}
      maxWidthClass="max-w-6xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Stats stats={course.stats} />
          <button
            type="button"
            className="btn btn-accent btn-sm gap-1.5"
            onClick={() => startChat()}
            disabled={starting}
            data-guide="course-start-chat"
          >
            <Bot size={15} aria-hidden="true" />
            {starting ? t("course.starting_chat") : t("course.start_chat")}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-base-300 py-2">
          <div
            className="join"
            role="group"
            aria-label={t("course.mode_label")}
          >
            <button
              type="button"
              className={`btn btn-sm join-item ${
                mode === "learn" ? "btn-active" : "btn-ghost"
              }`}
              aria-pressed={mode === "learn"}
              onClick={() => setMode("learn")}
              data-guide="course-mode-learn"
            >
              <GraduationCap size={14} aria-hidden="true" />
              {t("course.mode_learn")}
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${
                mode === "review" ? "btn-active" : "btn-ghost"
              }`}
              aria-pressed={mode === "review"}
              onClick={() => setMode("review")}
              data-guide="course-mode-review"
            >
              {t("course.mode_review")}
            </button>
          </div>

          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label={t("course.tabs_label")}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={`${mode}-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`btn btn-xs ${
                    active ? "btn-active" : "btn-ghost"
                  }`}
                  data-guide={tab.guide}
                  onClick={() =>
                    mode === "review"
                      ? setReviewTab(tab.id)
                      : setLearnTab(tab.id)
                  }
                >
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "review" ? (
          <CourseReview course={course} tab={activeTab} />
        ) : activeTab === "skills" ? (
          <CourseSkills
            course={course}
            onOpenLernseite={(entry) => {
              setLernseiteUrl(entry.url);
              setLearnTab("lernseiten");
            }}
            onQuizSkill={(skill) => {
              setQuizSkill(skill.key);
              setLearnTab("quiz");
            }}
            onChatSkill={(skill) =>
              startChat(
                t("course.skills.chat_prompt", {
                  name: skill.name,
                  description: skill.description || "",
                }),
              )
            }
          />
        ) : activeTab === "quiz" ? (
          <CourseQuiz
            key={quizSkill || "all"}
            course={course}
            initialSkill={quizSkill}
          />
        ) : (
          <CourseLernseiten
            course={course}
            selectedUrl={lernseiteUrl}
            onSelect={setLernseiteUrl}
          />
        )}
      </div>
    </InfoLayout>
  );
}
