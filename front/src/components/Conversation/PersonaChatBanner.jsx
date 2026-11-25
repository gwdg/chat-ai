import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Bot, Course } from "@carbon/icons-react";

import { brandPersonaBanners } from "../../config/brandFeatures";

export default function PersonaChatBanner({
  persona,
  localState,
  setLocalState,
  sendMessage,
}) {
  const { t } = useTranslation();
  const banners = brandPersonaBanners();

  const title = String(persona?.title || "").trim();
  const description = String(persona?.description || "").trim();
  const category = String(persona?.category || "").trim();
  const courseId = String(persona?.courseId || "").trim();

  if (!title && !description) return null;

  return (
    <div className="mx-auto mb-2 flex w-full md:max-w-[85vw] xl:max-w-[1300px] items-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm">
      {courseId ? (
        <Course
          size={16}
          className="mt-0.5 shrink-0 text-accent"
          aria-hidden="true"
        />
      ) : (
        <Bot
          size={16}
          className="mt-0.5 shrink-0 text-accent"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-base-content">
          {courseId ? t("course.banner_label") : t("persona.chat_label")}
          {title && (
            <span className="font-normal text-base-content/70">
              {" · "}
              {title}
            </span>
          )}
        </p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">
            {description}
          </p>
        )}
        {category && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/50">
            {t("persona.category_label")}: {category}
          </p>
        )}
        {courseId && (
          <Link
            to={`/course/${courseId}`}
            data-guide="course-banner-link"
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-info hover:underline"
          >
            <Course size={11} aria-hidden="true" />
            {t("course.open_course")}
          </Link>
        )}
        {banners.map((Banner, index) => (
          <Banner
            key={index}
            persona={persona}
            localState={localState}
            setLocalState={setLocalState}
            sendMessage={sendMessage}
          />
        ))}
      </div>
    </div>
  );
}
