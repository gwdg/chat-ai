import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Loading view for a single model answer that is rendered while it streams in.
 *
 * Used by the dialogs that block on one answer (Sort & organize, Summarize
 * chat): spinner, what is being generated, and a live line with the words
 * received so far plus the elapsed time. The word counter only moves when a
 * chunk arrives, so the seconds tick on their own; otherwise the dialog looks
 * frozen whenever the model pauses.
 */
export default function ModelProgress({
  title,
  description,
  words = 0,
  reasoningWords = 0,
  dataGuide,
}) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const status = [
    words > 0
      ? t("common.received_words", { count: words })
      : reasoningWords > 0
        ? t("common.reasoning_words", { count: reasoningWords })
        : null,
    t("common.elapsed_seconds", { count: elapsed }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-300 px-4 py-8 text-center">
      <div className="loading loading-spinner loading-md text-accent" />
      {title && (
        <p className="text-sm font-medium text-base-content">{title}</p>
      )}
      {description && (
        <p className="text-xs text-base-content/70">{description}</p>
      )}
      <p
        data-guide={dataGuide}
        className="text-[11px] tabular-nums text-base-content/60"
      >
        {status}
      </p>
    </div>
  );
}
