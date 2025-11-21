import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock3, Download, Video } from "lucide-react";

export default function VideoQueuePreview({ jobs = [], onDownload = () => {} }) {
  const { t } = useTranslation();
  const hasJobs = Array.isArray(jobs) && jobs.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-bg_secondary_dark">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200">
          <Video className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t("settings.video_queue_title")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("settings.video_queue_subtitle")}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-2.5">
        {!hasJobs && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            {t("settings.video_queue_empty")}
          </div>
        )}

        {hasJobs &&
          jobs.map((job) => {
            const isDone = job.status === "done";
            return (
              <div
                key={job.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                      {job.id}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {t("settings.video_queue_job_label", { count: job.id })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                        isDone
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-100 dark:border dark:border-green-700"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:border dark:border-amber-700",
                      ].join(" ")}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isDone
                        ? t("settings.video_queue_status_ready")
                        : t("settings.video_queue_status_processing")}
                    </span>
                    {isDone && (
                      <button
                        type="button"
                        onClick={() => onDownload(job)}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 dark:ring-offset-gray-900"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("settings.video_queue_download")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 h-2 rounded-full bg-white shadow-inner dark:bg-gray-800">
                  <div
                    className={[
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      isDone ? "bg-green-500" : "bg-blue-500",
                    ].join(" ")}
                    style={{ width: `${job.progress}%` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                  {isDone
                    ? t("settings.video_queue_eta_done")
                    : t("settings.video_queue_eta", { seconds: job.remainingSeconds })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
