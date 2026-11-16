import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "@carbon/icons-react";

import ChatFilePreview from "./ChatFilePreview";
import PanelShell from "../DocumentPanel/PanelShell";
import { loadFile, useFileMeta } from "../../db";
import { useFilePreview } from "../../context/FilePreviewContext";
import { useToast } from "../../hooks/useToast";
import { downloadBlob } from "../../utils/download";
import { formatBytes } from "../../utils/formatBytes";

// The docked preview of a conversation file. Pages render it as a sibling of their
// content column, exactly like the workspace and agent file panels, so an attachment
// opens on the side instead of in a modal.
export default function ChatFilePreviewPanel() {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { preview, closeFilePreview } = useFilePreview();
  const file = useFileMeta(preview?.fileId);

  // Leaving the page closes the panel instead of restoring it on the next visit.
  useEffect(() => () => closeFilePreview(), [closeFilePreview]);

  if (!preview) return null;

  const name = file?.name ?? preview.name ?? t("file_preview.no_file");
  const subtitle = [
    file?.type,
    typeof file?.size === "number" ? formatBytes(file.size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleDownload = async () => {
    try {
      const complete = await loadFile(preview.fileId);
      if (!complete) {
        notifyError(t("file_preview.save_failed"));
        return;
      }
      downloadBlob(complete, complete.name || name);
    } catch (error) {
      console.error("Download failed:", error);
      notifyError(t("file_preview.save_failed"));
    }
  };

  return (
    <PanelShell
      title={name}
      subtitle={subtitle}
      onClose={closeFilePreview}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => void handleDownload()}
          disabled={!file}
          aria-label={t("file_preview.download_aria")}
          title={t("file_preview.download_aria")}
        >
          <Download size={18} />
        </button>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <ChatFilePreview
          key={preview.fileId}
          fileId={preview.fileId}
          file={file}
        />
      </div>
    </PanelShell>
  );
}
