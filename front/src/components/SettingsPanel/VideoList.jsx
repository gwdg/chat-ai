import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock3, Download, CircleX, Trash2 } from "lucide-react";
import { useUpdateVideoList } from "../../hooks/useUpdateVideoList";
import { downloadVideo, deleteVideo } from "../../apis/videoListApi";

export default function VideoList() {
  const { t } = useTranslation();
  const videoList = useUpdateVideoList();

  const ids =
    videoList && typeof videoList === "object"
      ? Object.keys(videoList)
      : [];

  const hasJobs = ids.length > 0;

    /* ---------- Download handler ---------- */
    const onDownload = async (id) => {
    const response = await downloadVideo(id);
    const json = await response.json();

    const byteCharacters = atob(json.data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const blob = new Blob(
      [new Uint8Array(byteNumbers)],
      { type: json.content_type }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = json.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Delete handler ---------- */
  const onDelete = async (id) => {
    try {
      await deleteVideo(id);
      // No manual state update needed;
      // polling hook will refresh within 10s
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const renderStatus = (status) => {
    switch (status) {
      case "completed":
        return {
          label: t("settings.video_queue_status_ready"),
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          className:
            "bg-success/10 text-success",
        };
      case "failed":
        return {
          label: t("settings.video_queue_status_failed"),
          icon: <CircleX className="h-3.5 w-3.5" />,
          className:
            "bg-error/10 text-error",
        };
      case "deleted":
        return {
          label: t("settings.video_queue_status_deleted"),
          icon: <CircleX className="h-3.5 w-3.5" />,
          className:
            "bg-base-300 text-base-content",
        };
      case "queued":
        return {
          label: t("settings.video_queue_status_queued"),
          icon: <Clock3 className="h-3.5 w-3.5" />,
          className:
            "bg-base-300 text-base-content",
        };
      default:
        return {
          label: t("settings.video_queue_status_processing"),
          icon: <Clock3 className="h-3.5 w-3.5" />,
          className:
            "bg-warning/10 text-amber-700 dark:text-amber-100",
        };
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 shadow-sm">
      <div className="px-4 pb-4 pt-3 space-y-2.5">
        {!hasJobs && (
          <div className="rounded-lg border border-dashed border-base-300 bg-base-200 p-4 text-center text-sm text-base-content/70">
            {t("settings.video_queue_empty")}
          </div>
        )}

        {hasJobs &&
          ids.map((id) => {
            const job = videoList[id];
            const statusInfo = renderStatus(job.status);

            return (
              <div
                key={id}
                className="rounded-lg border border-base-300 bg-base-200 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${statusInfo.className}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {job.prompt}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === "completed" && (
                      <button
                        onClick={() => onDownload(id)}
                        className="inline-flex items-center gap-1 rounded-md bg-info px-2.5 py-2 text-xs font-semibold text-white hover:bg-info/90"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {/* {t("settings.video_queue_download")} */}
                      </button>
                    )}

                    {job.status !== "processing" && (
                      <button
                        onClick={() => onDelete(id)}
                        className="inline-flex items-center gap-1 rounded-md bg-error px-2.5 py-2 text-xs font-semibold text-white hover:bg-error/90"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {/* {t("settings.video_queue_delete")} */}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}