import { useTranslation } from "react-i18next";
import { Bot } from "@carbon/icons-react";

export default function PersonaChatBanner({ persona }) {
  const { t } = useTranslation();

  const title = String(persona?.title || "").trim();
  const description = String(persona?.description || "").trim();
  const category = String(persona?.category || "").trim();

  if (!title && !description) return null;

  return (
    <div className="mx-1 mb-1 flex items-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm">
      <Bot
        size={16}
        className="mt-0.5 shrink-0 text-accent"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-base-content">
          {t("persona.chat_label")}
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
      </div>
    </div>
  );
}
