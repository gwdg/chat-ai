import { ChevronLeft, Close, Document, Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import FilePreviewContent from "../DocumentPanel/FilePreviewContent";
import { formatBytes } from "../../utils/formatBytes";

export default function WorkspacePreviewTab({
  preview,
  onClose,
  onDownload,
  showPdfHint = false,
  resetKey,
  onBack,
}) {
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
      {/* Same header as the docked file preview a regular chat opens, so a file
          looks the same whether it sits in this tab or beside a chat. */}
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square shrink-0"
            data-guide="workspace-preview-back"
            title={t("common.back")}
            aria-label={t("common.back")}
            onClick={onBack}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-base-200 text-accent sm:flex">
          <Document size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{entry.name}</h2>
          {subtitle && (
            <p className="truncate text-[11px] text-base-content/50">
              {subtitle}
            </p>
          )}
        </div>
        {onDownload && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            data-guide="workspace-preview-download"
            title={t("workspace.download")}
            aria-label={t("workspace.download")}
            onClick={() => onDownload(entry)}
          >
            <Download size={18} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          data-guide="workspace-preview-close"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Close size={18} />
        </button>
      </div>
      <div
        data-guide="workspace-preview-body"
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        <FilePreviewContent
          {...preview}
          showPdfHint={showPdfHint}
          resetKey={resetKey ?? preview.entry?.name}
        />
      </div>
    </section>
  );
}
