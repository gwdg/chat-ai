import { useTranslation } from "react-i18next";
import { Clock3, Video } from "lucide-react";
import Tooltip from "../Others/Tooltip";

export default function VideoQueueRailButton({ videoQueue, enabled, onOpen }) {
  const { t } = useTranslation();

  if (!enabled || !videoQueue) return null;

  const processing = videoQueue.processingCount || 0;
  const ready = videoQueue.readyCount || 0;
  const total = videoQueue.total || 0;
  if (total === 0) return null;

  const tooltipText =
    processing > 0
      ? t("settings.video_queue_badge_tooltip_processing", {
          processing,
          ready,
        })
      : t("settings.video_queue_badge_tooltip_ready", { ready });

  return (
    <Tooltip text={tooltipText} placement="right">
      <button
        type="button"
        onClick={() => onOpen?.()}
        className={[
          "relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm cursor-pointer transition",
          processing > 0
            ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800"
            : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800",
        ].join(" ")}
        aria-label={t("settings.video_queue_badge_label")}
      >
        <Video className="h-5 w-5" aria-hidden="true" />
        <span
          className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-gray-900 px-1 text-[11px] font-semibold text-white shadow-md dark:bg-gray-100 dark:text-gray-900"
          aria-hidden="true"
        >
          {processing > 0 ? processing : ready}
        </span>
        {processing > 0 && (
          <Clock3 className="absolute -bottom-1 -left-1 h-4 w-4 rounded-full bg-white p-0.5 text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-200" />
        )}
      </button>
    </Tooltip>
  );
}
