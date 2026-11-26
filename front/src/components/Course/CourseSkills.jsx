import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ListChecks, MessageSquare, Search } from "lucide-react";

import {
  countQuestionsBySkill,
  skillKeysWithLernseite,
} from "../../utils/gaiaContent";

/**
 * The learning view's skills browser: topics in course order, each skill with
 * its prerequisites, question count, and the actions that use it (open the
 * self-learning page, practise its quiz, or ask the course tutor about it).
 */
export default function CourseSkills({
  course,
  onOpenLernseite,
  onQuizSkill,
  onChatSkill,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const questionCounts = useMemo(
    () => countQuestionsBySkill(course.questions),
    [course.questions],
  );
  const lernseiteSkills = useMemo(
    () => skillKeysWithLernseite(course.lernseiten),
    [course.lernseiten],
  );
  const lernseiteBySkill = useMemo(() => {
    const map = new Map();
    for (const entry of course.lernseiten) {
      if (entry.skill && !map.has(entry.skill)) map.set(entry.skill, entry);
    }
    return map;
  }, [course.lernseiten]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return course.groups;
    return course.groups
      .map((group) => ({
        ...group,
        skills: group.skills.filter((skill) =>
          [
            skill.name,
            skill.concept,
            skill.description,
            ...skill.prerequisites,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        ),
      }))
      .filter((group) => group.skills.length > 0);
  }, [course.groups, query]);

  return (
    <div data-guide="course-skills" className="flex flex-col gap-4">
      <label className="input input-sm flex w-full items-center gap-2">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          className="grow"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("course.skills.search")}
          aria-label={t("course.skills.search")}
        />
      </label>

      {groups.length === 0 && (
        <p className="text-sm text-base-content/70">{t("course.skills.empty")}</p>
      )}

      {groups.map(({ topic, skills }) => (
        <section
          key={topic.key}
          className="overflow-hidden rounded-xl border border-base-300 bg-base-100"
        >
          <header className="border-b border-base-300 bg-base-200/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-base-content">
              {topic.name}
            </h3>
            {topic.description && (
              <p className="mt-1 text-xs leading-relaxed text-base-content/70">
                {topic.description}
              </p>
            )}
          </header>
          <ul className="divide-y divide-base-300">
            {skills.map((skill) => {
              const count = questionCounts.get(skill.key) || 0;
              const lernseite = lernseiteBySkill.get(skill.key);
              return (
                <li key={skill.key} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-base-content">
                        {skill.name}
                      </p>
                      {skill.description && (
                        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
                          {skill.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {count > 0 && (
                          <span className="badge badge-ghost badge-sm">
                            {t("course.skills.questions", { n: count })}
                          </span>
                        )}
                        {skill.prerequisiteSkills.length > 0 && (
                          <span
                            className="badge badge-ghost badge-sm max-w-full"
                            title={skill.prerequisiteSkills
                              .map((entry) => entry.name)
                              .join(", ")}
                          >
                            {t("course.skills.needs", {
                              names: skill.prerequisiteSkills
                                .map((entry) => entry.name)
                                .join(", "),
                            })}
                          </span>
                        )}
                        {lernseiteSkills.has(skill.key) && (
                          <span className="badge badge-outline badge-success badge-sm">
                            {t("course.skills.lernseite")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {lernseite && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={() => onOpenLernseite?.(lernseite)}
                        >
                          <BookOpen size={13} aria-hidden="true" />
                          {t("course.skills.open_lernseite")}
                        </button>
                      )}
                      {count > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={() => onQuizSkill?.(skill)}
                        >
                          <ListChecks size={13} aria-hidden="true" />
                          {t("course.skills.quiz")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-1"
                        onClick={() => onChatSkill?.(skill)}
                        title={t("course.skills.chat_about")}
                      >
                        <MessageSquare size={13} aria-hidden="true" />
                        {t("course.skills.chat")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
