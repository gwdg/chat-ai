import { Close, Document, Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import FilePreviewContent from "../DocumentPanel/FilePreviewContent";
import { formatBytes } from "../../utils/formatBytes";

export default function WorkspacePreviewTab({ preview, onClose, onDownload }) {
  const { t } = useTranslation();
  const entry = preview.entry;
  const subtitle = [
    entry.mime,
    typeof entry.size === "number" ? formatBytes(entry.size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      data-guide="workspace-preview-panel"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
        <Document size={14} className="shrink-0 text-base-content/45" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{entry.name}</p>
          <p className="truncate text-[11px] text-base-content/50">
            {subtitle}
          </p>
        </div>
        {onDownload && (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            data-guide="workspace-preview-download"
            title={t("workspace.download")}
            aria-label={t("workspace.download")}
            onClick={() => onDownload(entry)}
          >
            <Download size={16} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          data-guide="workspace-preview-close"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Close size={16} />
        </button>
      </div>
      <div
        data-guide="workspace-preview-body"
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        <FilePreviewContent {...preview} />
      </div>
    </section>
  );
}
